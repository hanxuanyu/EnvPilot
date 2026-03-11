package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"strconv"
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

func (c *mysqlConnector) TypeID() string { return c.target.PluginType }

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

	return connector.ExecuteStatement(ctx, db, query, limit)
}

func (c *mysqlConnector) GetTableDetail(ctx context.Context, database, table string) (*connector.TableDetail, error) {
	db, err := c.ensureDB(ctx, database)
	if err != nil {
		return nil, err
	}

	quotedTable := quoteMySQLIdentifier(table)
	rows, err := db.QueryContext(ctx, fmt.Sprintf("SHOW FULL COLUMNS FROM %s", quotedTable))
	if err != nil {
		return nil, fmt.Errorf("查询字段列表失败: %w", err)
	}
	defer rows.Close()

	columns := make([]connector.TableColumn, 0)
	for rows.Next() {
		var field, fieldType, nullFlag, keyName, extra, privileges, comment string
		var collation sql.NullString
		var defaultValue sql.NullString
		if err := rows.Scan(&field, &fieldType, &collation, &nullFlag, &keyName, &defaultValue, &extra, &privileges, &comment); err != nil {
			return nil, fmt.Errorf("读取字段信息失败: %w", err)
		}
		columns = append(columns, connector.TableColumn{
			Name:         field,
			Type:         fieldType,
			Nullable:     strings.EqualFold(nullFlag, "YES"),
			DefaultValue: defaultValue.String,
			Key:          keyName,
			Extra:        extra,
			Comment:      comment,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("读取字段列表失败: %w", err)
	}

	indexRows, err := db.QueryContext(ctx, `
		SELECT index_name, non_unique, seq_in_index, column_name, index_type
		FROM information_schema.statistics
		WHERE table_schema = DATABASE()
		  AND table_name = ?
		ORDER BY index_name ASC, seq_in_index ASC
	`, strings.TrimSpace(table))
	if err != nil {
		return nil, fmt.Errorf("查询索引信息失败: %w", err)
	}
	defer indexRows.Close()

	indexes := make([]connector.TableIndex, 0)
	indexPos := make(map[string]int)
	for indexRows.Next() {
		var indexName, columnName, indexType string
		var nonUnique int
		var sequence int
		if err := indexRows.Scan(&indexName, &nonUnique, &sequence, &columnName, &indexType); err != nil {
			return nil, fmt.Errorf("读取索引信息失败: %w", err)
		}

		position, exists := indexPos[indexName]
		if !exists {
			indexes = append(indexes, connector.TableIndex{
				Name:    indexName,
				Unique:  nonUnique == 0,
				Primary: strings.EqualFold(indexName, "PRIMARY"),
				Method:  indexType,
			})
			position = len(indexes) - 1
			indexPos[indexName] = position
		}
		if strings.TrimSpace(columnName) != "" {
			indexes[position].Columns = append(indexes[position].Columns, columnName)
		}
	}
	if err := indexRows.Err(); err != nil {
		return nil, fmt.Errorf("读取索引信息失败: %w", err)
	}

	var tableName, createSQL string
	if err := db.QueryRowContext(ctx, fmt.Sprintf("SHOW CREATE TABLE %s", quotedTable)).Scan(&tableName, &createSQL); err != nil {
		return nil, fmt.Errorf("查询建表语句失败: %w", err)
	}

	return &connector.TableDetail{
		Database:  c.currentDB,
		Table:     strings.TrimSpace(table),
		Columns:   columns,
		Indexes:   indexes,
		CreateSQL: createSQL,
	}, nil
}

func (c *mysqlConnector) ProbeMetadata(ctx context.Context) (*connector.MetadataProbeResult, error) {
	db, err := c.ensureDB(ctx, "")
	if err != nil {
		return nil, err
	}

	metrics := map[string]any{
		"database": c.currentDB,
	}
	details := make([]string, 0, 3)

	var version, versionComment, hostname string
	if err := db.QueryRowContext(ctx, "SELECT @@version, @@version_comment, @@hostname").Scan(&version, &versionComment, &hostname); err == nil {
		metrics["server_version"] = version
		metrics["version_comment"] = versionComment
		metrics["server_host"] = hostname
		details = append(details, "版本 "+version)
	}

	if databases, err := c.ListDatabases(ctx); err == nil {
		metrics["database_count"] = len(databases)
		details = append(details, "数据库 "+strconv.Itoa(len(databases))+" 个")
	}

	if c.cfg.Database != "" {
		if tables, err := c.ListTables(ctx, c.cfg.Database); err == nil {
			metrics["table_count"] = len(tables)
			details = append(details, "表 "+strconv.Itoa(len(tables))+" 个")
		}
	}

	detail := "MySQL 只读探测完成"
	if len(details) > 0 {
		detail += "：" + strings.Join(details, "，")
	}

	return &connector.MetadataProbeResult{Detail: detail, Metrics: metrics}, nil
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
	parsedDSN.MultiStatements = true
	parsedDSN.Timeout = 10 * time.Second
	parsedDSN.ReadTimeout = 30 * time.Second
	parsedDSN.WriteTimeout = 30 * time.Second
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
				switch key {
				case "timeout":
					if duration, parseErr := time.ParseDuration(values[0]); parseErr == nil {
						parsedDSN.Timeout = duration
					}
				case "readTimeout":
					if duration, parseErr := time.ParseDuration(values[0]); parseErr == nil {
						parsedDSN.ReadTimeout = duration
					}
				case "writeTimeout":
					if duration, parseErr := time.ParseDuration(values[0]); parseErr == nil {
						parsedDSN.WriteTimeout = duration
					}
				default:
					parsedDSN.Params[key] = values[0]
				}
			}
		}
	}

	db, err := sql.Open("mysql", parsedDSN.FormatDSN())
	if err != nil {
		return nil, fmt.Errorf("打开 MySQL 连接失败: %w", err)
	}
	db.SetMaxOpenConns(4)
	db.SetMaxIdleConns(2)
	db.SetConnMaxIdleTime(2 * time.Minute)
	db.SetConnMaxLifetime(10 * time.Minute)
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("连接 MySQL 失败: %w", err)
	}

	c.db = db
	c.currentDB = wantedDB
	return db, nil
}

func quoteMySQLIdentifier(name string) string {
	return "`" + strings.ReplaceAll(strings.TrimSpace(name), "`", "``") + "`"
}
