package connector

import (
	"database/sql"
	"fmt"
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
