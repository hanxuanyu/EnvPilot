package rabbitmq

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/url"
	"time"

	"EnvPilot/internal/connector"

	"github.com/google/uuid"
	amqp "github.com/rabbitmq/amqp091-go"
)

func init() {
	connector.RegisterFactory("rabbitmq", newConnector)
}

type rabbitmqConnector struct {
	target *connector.Target
	cfg    rabbitmqConfig
	conn   *amqp.Connection
	ch     *amqp.Channel
}

type rabbitmqConfig struct {
	Host     string
	Port     int
	VHost    string
	TLS      bool
	Username string
	Password string
}

func newConnector(target *connector.Target) (connector.Connector, error) {
	cfg, err := parseConfig(target)
	if err != nil {
		return nil, err
	}
	return &rabbitmqConnector{target: target, cfg: cfg}, nil
}

func parseConfig(target *connector.Target) (rabbitmqConfig, error) {
	host := target.ExtConfig.GetString("host")
	port := target.ExtConfig.GetInt("port")
	if host == "" {
		return rabbitmqConfig{}, fmt.Errorf("RabbitMQ 主机地址不能为空")
	}
	if port == 0 {
		port = 5672
	}

	vhost := target.ExtConfig.GetString("vhost")
	if vhost == "" {
		vhost = "/"
	}

	result := rabbitmqConfig{Host: host, Port: port, VHost: vhost, TLS: target.ExtConfig.GetBool("tls")}
	if target.Credential != nil {
		result.Username = target.Credential.Username
		result.Password = target.Credential.Secret
	}
	return result, nil
}

func (c *rabbitmqConnector) TypeID() string { return c.target.PluginType }

func (c *rabbitmqConnector) Connect(ctx context.Context) error {
	_, _, err := c.ensureChannel(ctx)
	return err
}

func (c *rabbitmqConnector) Ping(ctx context.Context) error {
	conn, ch, err := c.ensureChannel(ctx)
	if err != nil {
		return err
	}
	if conn.IsClosed() || ch.IsClosed() {
		return fmt.Errorf("RabbitMQ 连接已关闭")
	}
	return nil
}

func (c *rabbitmqConnector) Close() error {
	if c.ch != nil {
		_ = c.ch.Close()
		c.ch = nil
	}
	if c.conn != nil {
		err := c.conn.Close()
		c.conn = nil
		return err
	}
	return nil
}

func (c *rabbitmqConnector) SendMessage(ctx context.Context, msg connector.Message) (*connector.SendResult, error) {
	_, ch, err := c.ensureChannel(ctx)
	if err != nil {
		return nil, err
	}

	exchange := msg.Exchange
	routingKey := msg.RoutingKey
	if routingKey == "" {
		routingKey = msg.Topic
	}
	if exchange == "" && routingKey == "" {
		return nil, fmt.Errorf("RabbitMQ 发送消息需要 routing_key 或 topic")
	}

	headers := amqp.Table{}
	for key, value := range msg.Headers {
		headers[key] = value
	}

	messageID := uuid.NewString()
	pub := amqp.Publishing{
		Headers:      headers,
		ContentType:  "text/plain; charset=utf-8",
		Body:         []byte(msg.Body),
		MessageId:    messageID,
		Timestamp:    time.Now(),
		DeliveryMode: amqp.Persistent,
	}
	if err := ch.PublishWithContext(ctx, exchange, routingKey, false, false, pub); err != nil {
		return nil, fmt.Errorf("发送 RabbitMQ 消息失败: %w", err)
	}

	return &connector.SendResult{
		Success:   true,
		MessageID: messageID,
		Detail:    fmt.Sprintf("exchange=%s routing_key=%s", exchange, routingKey),
	}, nil
}

func (c *rabbitmqConnector) ensureChannel(ctx context.Context) (*amqp.Connection, *amqp.Channel, error) {
	if c.conn != nil && c.ch != nil && !c.conn.IsClosed() && !c.ch.IsClosed() {
		return c.conn, c.ch, nil
	}

	_ = c.Close()

	scheme := "amqp"
	if c.cfg.TLS {
		scheme = "amqps"
	}
	uri := fmt.Sprintf(
		"%s://%s:%s@%s:%d/%s",
		scheme,
		url.QueryEscape(c.cfg.Username),
		url.QueryEscape(c.cfg.Password),
		c.cfg.Host,
		c.cfg.Port,
		url.PathEscape(c.cfg.VHost),
	)

	type dialResult struct {
		conn *amqp.Connection
		err  error
	}

	resultCh := make(chan dialResult, 1)
	go func() {
		if c.cfg.TLS {
			conn, err := amqp.DialTLS(uri, &tls.Config{MinVersion: tls.VersionTLS12})
			resultCh <- dialResult{conn: conn, err: err}
			return
		}
		conn, err := amqp.Dial(uri)
		resultCh <- dialResult{conn: conn, err: err}
	}()

	select {
	case <-ctx.Done():
		return nil, nil, ctx.Err()
	case result := <-resultCh:
		if result.err != nil {
			return nil, nil, fmt.Errorf("连接 RabbitMQ 失败: %w", result.err)
		}
		ch, err := result.conn.Channel()
		if err != nil {
			_ = result.conn.Close()
			return nil, nil, fmt.Errorf("打开 RabbitMQ Channel 失败: %w", err)
		}
		c.conn = result.conn
		c.ch = ch
		return c.conn, c.ch, nil
	}
}
