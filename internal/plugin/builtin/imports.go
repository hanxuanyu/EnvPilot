package builtin

import (
	_ "EnvPilot/internal/plugin/builtin/kafka"
	_ "EnvPilot/internal/plugin/builtin/mysql"
	_ "EnvPilot/internal/plugin/builtin/postgresql"
	_ "EnvPilot/internal/plugin/builtin/rabbitmq"
	_ "EnvPilot/internal/plugin/builtin/redis"
	_ "EnvPilot/internal/plugin/builtin/rocketmq"
)
