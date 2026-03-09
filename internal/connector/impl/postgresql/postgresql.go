package postgresql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"EnvPilot/internal/connector"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func init() {
	connector.RegisterFactory("postgresql", newConnector)
}

type postgresqlConnector struct {
	target    *connector.Target
	cfg       postgresqlConfig
	db        *sql.DB
	currentDB string
}

type postgresqlConfig struct {
	Host     string
	Port     int
	Database string
	Schema   string
	SSLMode  string
	Username string
	Password string
}

func newConnector(target *connector.Target) (connector.Connector, error) {
	cfg, err := parseConfig(target)
	if err != nil {
		return nil, err
	}
	return &postgresqlConnector{target: target, cfg: cfg}, nil
}

func parseConfig(target *connector.Target) (postgresqlConfig, error) {
	if target.Credential == nil {
		return postgresqlConfig{}, fmt.Errorf("PostgreSQL 资产缺少访问凭据")
	}

	host := target.ExtConfig.GetString("host")
	port := target.ExtConfig.GetInt("port")
	if host == "" {
		return postgresqlConfig{}, fmt.Errorf("PostgreSQL 主机地址不能为空")
	}
	if port == 0 {
		port = 5432
	}

	schema := target.ExtConfig.GetString("schema")
	if schema == "" {
		schema = "public"
	}

	sslMode := target.ExtConfig.GetString("ssl_mode")
	if sslMode == "" {
		sslMode = "disable"
	}

	return postgresqlConfig{
		Host:     host,
		Port:     port,
		Database: target.ExtConfig.GetString("database"),
		Schema:   schema,
		SSLMode:  sslMode,
		Username: target.Credential.Username,
		Password: target.Credential.Secret,
	}, nil
}

func (c *postgresqlConnector) TypeID() string {
	return c.target.PluginType
}

func (c *postgresqlConnector) Connect(ctx context.Context) error {
	_, err := c.ensureDB(ctx, "")
	return err
}

func (c *postgresqlConnector) Ping(ctx context.Context) error {
	db, err := c.ensureDB(ctx, "")
	if err != nil {
		return err
	}
	return db.PingContext(ctx)
}

func (c *postgresqlConnector) Close() error {
	if c.db != nil {
		err := c.db.Close()
		c.db = nil
		c.currentDB = ""
		return err
	}
	return nil
}

func (c *postgresqlConnector) ListDatabases(ctx context.Context) ([]string, error) {
	db, err := c.ensureDB(ctx, "postgres")
	if err != nil {
		return nil, err
	}

	rows, err := db.QueryContext(ctx, `
		SELECT datname
		FROM pg_database
		WHERE datistemplate = false
		ORDER BY datname ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("查询数据库列表失败: %w", err)
	}
	defer rows.Close()

	items := make([]string, 0)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("读取数据库名称失败: %w", err)
		}
		items = append(items, name)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("读取数据库列表失败: %w", err)
	}

	return items, nil
}

func (c *postgresqlConnector) ListTables(ctx context.Context, database string) ([]string, error) {
	db, err := c.ensureDB(ctx, database)
	if err != nil {
		return nil, err
	}

	rows, err := db.QueryContext(ctx, `
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = $1
		ORDER BY table_name ASC
	`, c.cfg.Schema)
	if err != nil {
		return nil, fmt.Errorf("查询数据表列表失败: %w", err)
	}
	defer rows.Close()

	items := make([]string, 0)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("读取数据表名称失败: %w", err)
		}
		items = append(items, name)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("读取数据表列表失败: %w", err)
	}

	return items, nil
}

func (c *postgresqlConnector) Execute(ctx context.Context, database, query string, limit int) (*connector.QueryResult, error) {
	db, err := c.ensureDB(ctx, database)
	if err != nil {
		return nil, err
	}

	startedAt := time.Now()
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("执行 SQL 失败: %w", err)
	}
	defer rows.Close()

	columns, data, err := connector.ScanRows(rows, limit)
	if err != nil {
		return nil, err
	}

	return &connector.QueryResult{
		Columns:    columns,
		Rows:       data,
		Affected:   int64(len(data)),
		DurationMS: time.Since(startedAt).Milliseconds(),
	}, nil
}

func (c *postgresqlConnector) ensureDB(ctx context.Context, database string) (*sql.DB, error) {
	wantedDB := strings.TrimSpace(database)
	if wantedDB == "" {
		wantedDB = c.cfg.Database
	}
	if wantedDB == "" {
		wantedDB = "postgres"
	}

	if c.db != nil && c.currentDB == wantedDB {
		return c.db, nil
	}

	if c.db != nil {
		_ = c.db.Close()
		c.db = nil
		c.currentDB = ""
	}

	connString := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s search_path=%s",
		c.cfg.Host,
		c.cfg.Port,
		c.cfg.Username,
		c.cfg.Password,
		wantedDB,
		c.cfg.SSLMode,
		c.cfg.Schema,
	)

	db, err := sql.Open("pgx", connString)
	if err != nil {
		return nil, fmt.Errorf("打开 PostgreSQL 连接失败: %w", err)
	}
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("连接 PostgreSQL 失败: %w", err)
	}

	c.db = db
	c.currentDB = wantedDB
	return db, nil
}
