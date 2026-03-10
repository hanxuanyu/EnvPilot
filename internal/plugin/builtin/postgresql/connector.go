package postgresql

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"

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

func (c *postgresqlConnector) TypeID() string { return c.target.PluginType }

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
	rows, err := db.QueryContext(ctx, `SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname ASC`)
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
	rows, err := db.QueryContext(ctx, `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name ASC`, c.cfg.Schema)
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

	return connector.ExecuteStatement(ctx, db, query, limit)
}

func (c *postgresqlConnector) GetTableDetail(ctx context.Context, database, table string) (*connector.TableDetail, error) {
	db, err := c.ensureDB(ctx, database)
	if err != nil {
		return nil, err
	}

	rows, err := db.QueryContext(ctx, `
		SELECT
			a.attname,
			pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
			NOT a.attnotnull AS nullable,
			COALESCE(pg_get_expr(ad.adbin, ad.adrelid), '') AS default_value,
			COALESCE(col_description(a.attrelid, a.attnum), '') AS comment
		FROM pg_attribute a
		JOIN pg_class c ON c.oid = a.attrelid
		JOIN pg_namespace n ON n.oid = c.relnamespace
		LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
		WHERE n.nspname = $1
		  AND c.relname = $2
		  AND a.attnum > 0
		  AND NOT a.attisdropped
		ORDER BY a.attnum
	`, c.cfg.Schema, strings.TrimSpace(table))
	if err != nil {
		return nil, fmt.Errorf("查询字段列表失败: %w", err)
	}
	defer rows.Close()

	columns := make([]connector.TableColumn, 0)
	for rows.Next() {
		var name, dataType, defaultValue, comment string
		var nullable bool
		if err := rows.Scan(&name, &dataType, &nullable, &defaultValue, &comment); err != nil {
			return nil, fmt.Errorf("读取字段信息失败: %w", err)
		}
		columns = append(columns, connector.TableColumn{
			Name:         name,
			Type:         dataType,
			Nullable:     nullable,
			DefaultValue: defaultValue,
			Comment:      comment,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("读取字段列表失败: %w", err)
	}
	if len(columns) == 0 {
		return nil, fmt.Errorf("未找到数据表 %s", strings.TrimSpace(table))
	}

	primaryKeyRows, err := db.QueryContext(ctx, `
		SELECT a.attname
		FROM pg_index i
		JOIN pg_class c ON c.oid = i.indrelid
		JOIN pg_namespace n ON n.oid = c.relnamespace
		JOIN unnest(i.indkey) WITH ORDINALITY AS cols(attnum, ord) ON true
		JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = cols.attnum
		WHERE n.nspname = $1
		  AND c.relname = $2
		  AND i.indisprimary
		ORDER BY cols.ord
	`, c.cfg.Schema, strings.TrimSpace(table))
	if err != nil {
		return nil, fmt.Errorf("查询主键信息失败: %w", err)
	}
	defer primaryKeyRows.Close()

	primaryKeys := make([]string, 0)
	primaryKeySet := make(map[string]struct{})
	for primaryKeyRows.Next() {
		var columnName string
		if err := primaryKeyRows.Scan(&columnName); err != nil {
			return nil, fmt.Errorf("读取主键信息失败: %w", err)
		}
		primaryKeys = append(primaryKeys, columnName)
		primaryKeySet[columnName] = struct{}{}
	}
	if err := primaryKeyRows.Err(); err != nil {
		return nil, fmt.Errorf("读取主键信息失败: %w", err)
	}

	for index, column := range columns {
		if _, ok := primaryKeySet[column.Name]; ok {
			columns[index].Key = "PRI"
		}
	}

	indexRows, err := db.QueryContext(ctx, `
		SELECT
			index_class.relname AS index_name,
			idx.indisprimary,
			idx.indisunique,
			am.amname AS index_method,
			COALESCE(attr.attname, pg_get_indexdef(idx.indexrelid, cols.ordinality, true)) AS column_name,
			cols.ordinality
		FROM pg_class table_class
		JOIN pg_namespace n ON n.oid = table_class.relnamespace
		JOIN pg_index idx ON idx.indrelid = table_class.oid
		JOIN pg_class index_class ON index_class.oid = idx.indexrelid
		JOIN pg_am am ON am.oid = index_class.relam
		LEFT JOIN LATERAL unnest(idx.indkey) WITH ORDINALITY AS cols(attnum, ordinality) ON true
		LEFT JOIN pg_attribute attr ON attr.attrelid = table_class.oid AND attr.attnum = cols.attnum
		WHERE n.nspname = $1
		  AND table_class.relname = $2
		ORDER BY index_class.relname ASC, cols.ordinality ASC
	`, c.cfg.Schema, strings.TrimSpace(table))
	if err != nil {
		return nil, fmt.Errorf("查询索引信息失败: %w", err)
	}
	defer indexRows.Close()

	indexes := make([]connector.TableIndex, 0)
	indexPos := make(map[string]int)
	for indexRows.Next() {
		var indexName, indexMethod string
		var isPrimary, isUnique bool
		var columnName sql.NullString
		var ordinality sql.NullInt64
		if err := indexRows.Scan(&indexName, &isPrimary, &isUnique, &indexMethod, &columnName, &ordinality); err != nil {
			return nil, fmt.Errorf("读取索引信息失败: %w", err)
		}

		position, exists := indexPos[indexName]
		if !exists {
			indexes = append(indexes, connector.TableIndex{
				Name:    indexName,
				Primary: isPrimary,
				Unique:  isUnique,
				Method:  indexMethod,
			})
			position = len(indexes) - 1
			indexPos[indexName] = position
		}
		if columnName.Valid && strings.TrimSpace(columnName.String) != "" {
			indexes[position].Columns = append(indexes[position].Columns, columnName.String)
		}
	}
	if err := indexRows.Err(); err != nil {
		return nil, fmt.Errorf("读取索引信息失败: %w", err)
	}

	createSQL := buildPostgreSQLCreateSQL(c.cfg.Schema, strings.TrimSpace(table), columns, primaryKeys)
	return &connector.TableDetail{
		Database:  c.currentDB,
		Schema:    c.cfg.Schema,
		Table:     strings.TrimSpace(table),
		Columns:   columns,
		Indexes:   indexes,
		CreateSQL: createSQL,
	}, nil
}

func (c *postgresqlConnector) ProbeMetadata(ctx context.Context) (*connector.MetadataProbeResult, error) {
	db, err := c.ensureDB(ctx, "")
	if err != nil {
		return nil, err
	}

	metrics := map[string]any{
		"database": c.currentDB,
		"schema":   c.cfg.Schema,
	}
	details := make([]string, 0, 3)

	var version, databaseName, userName string
	if err := db.QueryRowContext(ctx, "SELECT version(), current_database(), current_user").Scan(&version, &databaseName, &userName); err == nil {
		metrics["server_version"] = version
		metrics["current_database"] = databaseName
		metrics["current_user"] = userName
		details = append(details, "数据库 "+databaseName)
	}

	if databases, err := c.ListDatabases(ctx); err == nil {
		metrics["database_count"] = len(databases)
		details = append(details, "实例 "+strconv.Itoa(len(databases))+" 个")
	}

	if tables, err := c.ListTables(ctx, c.currentDB); err == nil {
		metrics["table_count"] = len(tables)
		details = append(details, "Schema 表 "+strconv.Itoa(len(tables))+" 个")
	}

	detail := "PostgreSQL 只读探测完成"
	if len(details) > 0 {
		detail += "：" + strings.Join(details, "，")
	}

	return &connector.MetadataProbeResult{Detail: detail, Metrics: metrics}, nil
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

func buildPostgreSQLCreateSQL(schema, table string, columns []connector.TableColumn, primaryKeys []string) string {
	definitions := make([]string, 0, len(columns)+1)
	for _, column := range columns {
		parts := []string{quotePostgreSQLIdentifier(column.Name), column.Type}
		if column.DefaultValue != "" {
			parts = append(parts, "DEFAULT "+column.DefaultValue)
		}
		if !column.Nullable {
			parts = append(parts, "NOT NULL")
		}
		definitions = append(definitions, "    "+strings.Join(parts, " "))
	}
	if len(primaryKeys) > 0 {
		quotedPrimaryKeys := make([]string, 0, len(primaryKeys))
		for _, key := range primaryKeys {
			quotedPrimaryKeys = append(quotedPrimaryKeys, quotePostgreSQLIdentifier(key))
		}
		definitions = append(definitions, "    PRIMARY KEY ("+strings.Join(quotedPrimaryKeys, ", ")+")")
	}

	return "CREATE TABLE " + quotePostgreSQLIdentifier(schema) + "." + quotePostgreSQLIdentifier(table) + " (\n" + strings.Join(definitions, ",\n") + "\n);"
}

func quotePostgreSQLIdentifier(name string) string {
	return `"` + strings.ReplaceAll(strings.TrimSpace(name), `"`, `""`) + `"`
}
