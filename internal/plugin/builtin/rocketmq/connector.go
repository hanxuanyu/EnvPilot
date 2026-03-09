package rocketmq

import (
	"context"
	"fmt"
	"strings"

	"EnvPilot/internal/connector"

	rocketmq "github.com/apache/rocketmq-client-go/v2"
	"github.com/apache/rocketmq-client-go/v2/primitive"
	"github.com/apache/rocketmq-client-go/v2/producer"
)

func init() {
	connector.RegisterFactory("rocketmq", newConnector)
}

type rocketmqConnector struct {
	target   *connector.Target
	cfg      rocketmqConfig
	producer rocketmq.Producer
}

type rocketmqConfig struct {
	NameServers []string
	GroupID     string
	AccessKey   string
	SecretKey   string
}

func newConnector(target *connector.Target) (connector.Connector, error) {
	cfg, err := parseConfig(target)
	if err != nil {
		return nil, err
	}
	return &rocketmqConnector{target: target, cfg: cfg}, nil
}

func parseConfig(target *connector.Target) (rocketmqConfig, error) {
	parts := strings.FieldsFunc(target.ExtConfig.GetString("name_server"), func(r rune) bool {
		return r == ';' || r == ','
	})
	servers := make([]string, 0, len(parts))
	for _, item := range parts {
		trimmed := strings.TrimSpace(item)
		if trimmed != "" {
			servers = append(servers, trimmed)
		}
	}
	if len(servers) == 0 {
		return rocketmqConfig{}, fmt.Errorf("RocketMQ NameServer 地址不能为空")
	}

	groupID := strings.TrimSpace(target.ExtConfig.GetString("group_id"))
	if groupID == "" {
		groupID = fmt.Sprintf("envpilot_%d", target.AssetID)
	}

	accessKey := strings.TrimSpace(target.ExtConfig.GetString("access_key"))
	secretKey := strings.TrimSpace(target.ExtConfig.GetString("secret_key"))
	if target.Credential != nil {
		if accessKey == "" {
			accessKey = target.Credential.Username
		}
		if secretKey == "" {
			secretKey = target.Credential.Secret
		}
	}

	return rocketmqConfig{
		NameServers: servers,
		GroupID:     groupID,
		AccessKey:   accessKey,
		SecretKey:   secretKey,
	}, nil
}

func (c *rocketmqConnector) TypeID() string { return c.target.PluginType }

func (c *rocketmqConnector) Connect(ctx context.Context) error {
	_, err := c.ensureProducer()
	return err
}

func (c *rocketmqConnector) Ping(ctx context.Context) error {
	_, err := c.ensureProducer()
	return err
}

func (c *rocketmqConnector) ProbeMetadata(ctx context.Context) (*connector.MetadataProbeResult, error) {
	if _, err := c.ensureProducer(); err != nil {
		return nil, err
	}
	metrics := map[string]any{
		"group_id":          c.cfg.GroupID,
		"name_server_count": len(c.cfg.NameServers),
		"authenticated":     c.cfg.AccessKey != "" || c.cfg.SecretKey != "",
	}
	detail := fmt.Sprintf("RocketMQ Producer 已启动：NameServer %d 个", len(c.cfg.NameServers))
	return &connector.MetadataProbeResult{Detail: detail, Metrics: metrics}, nil
}

func (c *rocketmqConnector) Close() error {
	if c.producer != nil {
		err := c.producer.Shutdown()
		c.producer = nil
		return err
	}
	return nil
}

func (c *rocketmqConnector) SendMessage(ctx context.Context, msg connector.Message) (*connector.SendResult, error) {
	prod, err := c.ensureProducer()
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(msg.Topic) == "" {
		return nil, fmt.Errorf("RocketMQ 发送消息需要 topic")
	}

	rmqMessage := primitive.NewMessage(msg.Topic, []byte(msg.Body))
	if msg.Tag != "" {
		rmqMessage.WithTag(msg.Tag)
	}
	if msg.Key != "" {
		rmqMessage.WithKeys([]string{msg.Key})
	}
	for key, value := range msg.Headers {
		rmqMessage.WithProperty(key, value)
	}

	result, err := prod.SendSync(ctx, rmqMessage)
	if err != nil {
		return nil, fmt.Errorf("发送 RocketMQ 消息失败: %w", err)
	}
	return &connector.SendResult{Success: true, MessageID: result.MsgID, Detail: fmt.Sprintf("topic=%s", msg.Topic)}, nil
}

func (c *rocketmqConnector) ensureProducer() (rocketmq.Producer, error) {
	if c.producer != nil {
		return c.producer, nil
	}

	options := []producer.Option{
		producer.WithGroupName(c.cfg.GroupID),
		producer.WithNsResolver(primitive.NewPassthroughResolver(c.cfg.NameServers)),
		producer.WithRetry(1),
	}
	if c.cfg.AccessKey != "" || c.cfg.SecretKey != "" {
		options = append(options, producer.WithCredentials(primitive.Credentials{AccessKey: c.cfg.AccessKey, SecretKey: c.cfg.SecretKey}))
	}

	prod, err := rocketmq.NewProducer(options...)
	if err != nil {
		return nil, fmt.Errorf("创建 RocketMQ Producer 失败: %w", err)
	}
	if err := prod.Start(); err != nil {
		return nil, fmt.Errorf("启动 RocketMQ Producer 失败: %w", err)
	}

	c.producer = prod
	return c.producer, nil
}
