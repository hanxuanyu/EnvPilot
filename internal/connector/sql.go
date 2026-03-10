package connector

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

func ScanRows(rows *sql.Rows, limit int) ([]QueryColumn, []map[string]any, error) {
	columnTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, nil, fmt.Errorf("读取列信息失败: %w", err)
	}

	columns := make([]QueryColumn, 0, len(columnTypes))
	columnNames := make([]string, 0, len(columnTypes))
	for _, columnType := range columnTypes {
		columns = append(columns, QueryColumn{
			Name: columnType.Name(),
			Type: columnType.DatabaseTypeName(),
		})
		columnNames = append(columnNames, columnType.Name())
	}

	result := make([]map[string]any, 0)
	for rows.Next() {
		values := make([]any, len(columnNames))
		dest := make([]any, len(columnNames))
		for index := range values {
			dest[index] = &values[index]
		}

		if err := rows.Scan(dest...); err != nil {
			return nil, nil, fmt.Errorf("扫描结果行失败: %w", err)
		}

		row := make(map[string]any, len(columnNames))
		for index, name := range columnNames {
			row[name] = NormalizeValue(values[index])
		}
		result = append(result, row)

		if limit > 0 && len(result) >= limit {
			break
		}
	}

	if err := rows.Err(); err != nil {
		return nil, nil, fmt.Errorf("读取结果集失败: %w", err)
	}

	return columns, result, nil
}

func NormalizeValue(value any) any {
	switch typed := value.(type) {
	case nil:
		return nil
	case []byte:
		return string(typed)
	case time.Time:
		return typed.Format(time.RFC3339Nano)
	case []any:
		items := make([]any, 0, len(typed))
		for _, item := range typed {
			items = append(items, NormalizeValue(item))
		}
		return items
	case map[string]any:
		mapped := make(map[string]any, len(typed))
		for key, item := range typed {
			mapped[key] = NormalizeValue(item)
		}
		return mapped
	default:
		return value
	}
}

func ExecuteStatement(ctx context.Context, db *sql.DB, query string, limit int) (*QueryResult, error) {
	startedAt := time.Now()
	if statementReturnsRows(query) {
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			return nil, fmt.Errorf("执行 SQL 失败: %w", err)
		}
		defer rows.Close()

		columns, data, err := ScanRows(rows, limit)
		if err != nil {
			return nil, err
		}

		return &QueryResult{
			Columns:    columns,
			Rows:       data,
			Affected:   int64(len(data)),
			DurationMS: time.Since(startedAt).Milliseconds(),
			Summary:    "查询执行完成",
		}, nil
	}

	result, err := db.ExecContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("执行 SQL 失败: %w", err)
	}

	affected := int64(0)
	if rowsAffected, rowsErr := result.RowsAffected(); rowsErr == nil {
		affected = rowsAffected
	}

	return &QueryResult{
		Columns:    []QueryColumn{},
		Rows:       []map[string]any{},
		Affected:   affected,
		DurationMS: time.Since(startedAt).Milliseconds(),
		Summary:    "SQL 执行成功",
	}, nil
}

func statementReturnsRows(query string) bool {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return false
	}

	fields := strings.Fields(trimmed)
	if len(fields) == 0 {
		return false
	}

	firstToken := strings.ToUpper(fields[0])
	switch firstToken {
	case "SELECT", "SHOW", "DESC", "DESCRIBE", "EXPLAIN", "WITH", "VALUES", "TABLE", "PRAGMA":
		return true
	case "INSERT", "UPDATE", "DELETE":
		return strings.Contains(strings.ToUpper(trimmed), " RETURNING ") || strings.HasSuffix(strings.ToUpper(trimmed), " RETURNING")
	default:
		return false
	}
}
