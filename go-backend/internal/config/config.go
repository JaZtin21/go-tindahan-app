package config

import (
	"os"
)

type Config struct {
	Port        string
	DatabaseURL string
	RedisAddr   string
}

func LoadConfig() *Config {

	return &Config{
		Port:        getEnv("Port", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", ""),
		RedisAddr:   getEnv("REDIS_ADDR", ""),
	}
}

func getEnv(key string, fallback string) string {

	if value, exist := os.LookupEnv(key); exist {
		return value
	}

	return fallback

}
