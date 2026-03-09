package kafka

import (
	"context"
	"crypto/tls"
	"fmt"
	"strings"
	"time"

	"EnvPilot/internal/connector"

	kafkaGo "github.com/segmentio/kafka-go"
	"github.com/segmentio/kafka-go/sasl"
	plain "github.com/segmentio/kafka-go/sasl/plain"
	scram "github.com/segmentio/kafka-go/sasl/scram"
)

func init() {
	connector.RegisterFactory("kafka", newConnector)
}

type kafkaConnector struct {
	target *connector.Target
	cfg    kafkaConfig
}

type kafkaConfig struct {
	Brokers          []string
	SecurityProtocol string
	SASLMechanism    string
	Username         string
	Password         string
}

func newConnector(target *connector.Target) (connector.Connector, error) {
	cfg, err := parseConfig(target)
	if err != nil {
		return nil, err
	}
	return &kafkaConnector{target: target, cfg: cfg}, nil
}

func parseConfig(target *connector.Target) (kafkaConfig, error) {
	rawBrokers := strings.Split(target.ExtConfig.GetString("brokers"), ",")
	brokers := make([]string, 0, len(rawBrokers))
	for _, item := range rawBrokers {
		trimmed := strings.TrimSpace(item)
		if trimmed != "" {
			brokers = append(brokers, trimmed)
		}
	}
	if len(brokers) == 0 {
		return kafkaConfig{}, fmt.Errorf("Kafka Broker 地址不能为空")
	}

	result := kafkaConfig{
		Brokers:          brokers,
		SecurityProtocol: strings.ToUpper(strings.TrimSpace(target.ExtConfig.GetString("security_protocol"))),
		SASLMechanism:    strings.ToUpper(strings.TrimSpace(target.ExtConfig.GetString("sasl_mechanism"))),
	}
	if result.SecurityProtocol == "" {
		result.SecurityProtocol = "PLAINTEXT"
	}
	if target.Credential != nil {
		result.Username = target.Credential.Username
		result.Password = target.Credential.Secret
	}
	return result, nil
}

func (c *kafkaConnector) TypeID() string { return c.target.PluginType }

func (c *kafkaConnector) Connect(ctx context.Context) error {
	return c.Ping(ctx)
}

func (c *kafkaConnector) Ping(ctx context.Context) error {
	dialer, err := c.buildDialer()
	if err != nil {
		return err
	}
	conn, err := dialer.DialContext(ctx, "tcp", c.cfg.Brokers[0])
	if err != nil {
		return fmt.Errorf("连接 Kafka 失败: %w", err)
	}
	_ = conn.Close()
	return nil
}

func (c *kafkaConnector) Close() error { return nil }

func (c *kafkaConnector) SendMessage(ctx context.Context, msg connector.Message) (*connector.SendResult, error) {
	if strings.TrimSpace(msg.Topic) == "" {
		return nil, fmt.Errorf("Kafka 发送消息需要 topic")
	}

	transport, err := c.buildTransport()
	if err != nil {
		return nil, err
	}

	writer := &kafkaGo.Writer{
		Addr:      kafkaGo.TCP(c.cfg.Brokers...),
		Topic:     msg.Topic,
		Balancer:  &kafkaGo.LeastBytes{},
		Transport: transport,
	}
	defer writer.Close()

	headers := make([]kafkaGo.Header, 0, len(msg.Headers))
	for key, value := range msg.Headers {
		headers = append(headers, kafkaGo.Header{Key: key, Value: []byte(value)})
	}

	record := kafkaGo.Message{
		Key:     []byte(msg.Key),
		Value:   []byte(msg.Body),
		Headers: headers,
		Time:    time.Now(),
	}
	if err := writer.WriteMessages(ctx, record); err != nil {
		return nil, fmt.Errorf("发送 Kafka 消息失败: %w", err)
	}

	return &connector.SendResult{Success: true, Detail: fmt.Sprintf("topic=%s brokers=%d", msg.Topic, len(c.cfg.Brokers))}, nil
}

func (c *kafkaConnector) buildDialer() (*kafkaGo.Dialer, error) {
	mechanism, tlsConfig, err := c.authConfig()
	if err != nil {
		return nil, err
	}
	return &kafkaGo.Dialer{
		Timeout:       5 * time.Second,
		DualStack:     true,
		TLS:           tlsConfig,
		SASLMechanism: mechanism,
	}, nil
}

func (c *kafkaConnector) buildTransport() (*kafkaGo.Transport, error) {
	mechanism, tlsConfig, err := c.authConfig()
	if err != nil {
		return nil, err
	}
	return &kafkaGo.Transport{TLS: tlsConfig, SASL: mechanism}, nil
}

func (c *kafkaConnector) authConfig() (sasl.Mechanism, *tls.Config, error) {
	protocol := c.cfg.SecurityProtocol
	useTLS := protocol == "SSL" || protocol == "SASL_SSL"
	useSASL := protocol == "SASL_PLAINTEXT" || protocol == "SASL_SSL"

	var tlsConfig *tls.Config
	if useTLS {
		tlsConfig = &tls.Config{MinVersion: tls.VersionTLS12}
	}
	if !useSASL {
		return nil, tlsConfig, nil
	}
	if c.cfg.Username == "" {
		return nil, nil, fmt.Errorf("Kafka SASL 模式需要用户名凭据")
	}

	switch c.cfg.SASLMechanism {
	case "", "PLAIN":
		return plain.Mechanism{Username: c.cfg.Username, Password: c.cfg.Password}, tlsConfig, nil
	case "SCRAM-SHA-256":
		mechanism, err := scram.Mechanism(scram.SHA256, c.cfg.Username, c.cfg.Password)
		return mechanism, tlsConfig, err
	case "SCRAM-SHA-512":
		mechanism, err := scram.Mechanism(scram.SHA512, c.cfg.Username, c.cfg.Password)
		return mechanism, tlsConfig, err
	default:
		return nil, nil, fmt.Errorf("不支持的 Kafka SASL 机制: %s", c.cfg.SASLMechanism)
	}
}
