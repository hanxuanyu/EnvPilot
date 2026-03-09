package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"strings"
	"time"

	"EnvPilot/internal/connector"

	mysqldriver "github.com/go-sql-driver/mysql"
)

func init() {
	connector.RegisterFactory("mysql", newConnector)
}

type mysqlConnector struct {
	target    *connector.Target
	cfg       mysqlConfig
	db        *sql.DB
	currentDB string
}

type mysqlConfig struct {
	Host        string
	Port        int
	Database    string
	ExtraParams string
	SSLMode     string
	Username    string
	Password    string
}

func newConnector(target *connector.Target) (connector.Connector, error) {
	cfg, err := parseConfig(target)
	if err != nil {
		return nil, err
	}
	return &mysqlConnector{target: target, cfg: cfg}, nil
}

func parseConfig(target *connector.Target) (mysqlConfig, error) {
	if target.Credential == nil {
		return mysqlConfig{}, fmt.Errorf("MySQL 资产缺少访问凭据")
	}

	host := target.ExtConfig.GetString("host")
	port := target.ExtConfig.GetInt("port")
	if host == "" {
		return mysqlConfig{}, fmt.Errorf("MySQL 主机地址不能为空")
	}
	if port == 0 {
		port = 3306
	}

	return mysqlConfig{
		Host:        host,
		Port:        port,
		Database:    target.ExtConfig.GetString("database"),
		ExtraParams: target.ExtConfig.GetString("extra_params"),
		SSLMode:     target.ExtConfig.GetString("ssl_mode"),
		Username:    target.Credential.Username,
		Password:    target.Credential.Secret,
	}, nil
}

func (c *mysqlConnector) TypeID() string {
	return c.target.PluginType
}

func (c *mysqlConnector) Connect(ctx context.Context) error {
	_, err := c.ensureDB(ctx, "")
	return err
}

func (c *mysqlConnector) Ping(ctx context.Context) error {
	db, err := c.ensureDB(ctx, "")
	if err != nil {
		return err
	}
	return db.PingContext(ctx)
}

func (c *mysqlConnector) Close() error {
	if c.db != nil {
		err := c.db.Close()
		c.db = nil
		c.currentDB = ""
		return err
	}
	return nil
}

func (c *mysqlConnector) ListDatabases(ctx context.Context) ([]string, error) {
	db, err := c.ensureDB(ctx, "")
	if err != nil {
		return nil, err
	}

	rows, err := db.QueryContext(ctx, "SHOW DATABASES")
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

func (c *mysqlConnector) ListTables(ctx context.Context, database string) ([]string, error) {
	db, err := c.ensureDB(ctx, database)
	if err != nil {
		return nil, err
	}

	rows, err := db.QueryContext(ctx, "SHOW TABLES")
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

func (c *mysqlConnector) Execute(ctx context.Context, database, query string, limit int) (*connector.QueryResult, error) {
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

func (c *mysqlConnector) ensureDB(ctx context.Context, database string) (*sql.DB, error) {
	wantedDB := strings.TrimSpace(database)
	if wantedDB == "" {
		wantedDB = c.cfg.Database
	}

	if c.db != nil && c.currentDB == wantedDB {
		return c.db, nil
	}

	if c.db != nil {
		_ = c.db.Close()
		c.db = nil
		c.currentDB = ""
	}

	parsedDSN := mysqldriver.NewConfig()
	parsedDSN.Net = "tcp"
	parsedDSN.Addr = fmt.Sprintf("%s:%d", c.cfg.Host, c.cfg.Port)
	parsedDSN.User = c.cfg.Username
	parsedDSN.Passwd = c.cfg.Password
	parsedDSN.DBName = wantedDB
	parsedDSN.ParseTime = true

	if parsedDSN.Params == nil {
		parsedDSN.Params = make(map[string]string)
	}
	parsedDSN.Params["charset"] = "utf8mb4"

	switch c.cfg.SSLMode {
	case "require":
		parsedDSN.TLSConfig = "skip-verify"
	case "verify-ca":
		parsedDSN.TLSConfig = "true"
	default:
		parsedDSN.TLSConfig = "false"
	}

	if c.cfg.ExtraParams != "" {
		params, err := url.ParseQuery(c.cfg.ExtraParams)
		if err != nil {
			return nil, fmt.Errorf("解析 MySQL 额外连接参数失败: %w", err)
		}
		for key, values := range params {
			if len(values) > 0 {
				parsedDSN.Params[key] = values[0]
			}
		}
	}

	db, err := sql.Open("mysql", parsedDSN.FormatDSN())
	if err != nil {
		return nil, fmt.Errorf("打开 MySQL 连接失败: %w", err)
	}
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("连接 MySQL 失败: %w", err)
	}

	c.db = db
	c.currentDB = wantedDB
	return db, nil
}
