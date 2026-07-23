package main

import (
	"errors"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/golang-migrate/migrate/v4"
	pgxmigrate "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
)

func main() {
	// 1. Parse command-line flags
	action := flag.String("action", "", "Action to execute: 'down', 'force', 'version'")
	version := flag.Int("version", 0, "Migration timestamp version (required only if action is 'force')")
	dbURL := flag.String("conn", "postgres://postgres:password@localhost:5432/your_db_name?sslmode=disable", "PostgreSQL Connection String")
	flag.Parse()

	if *action == "" {
		fmt.Println("❌ Error: -action flag is required. Options: 'down', 'force', 'version'")
		os.Exit(1)
	}

	// 2. Parse connection configurations and establish raw SQL database handle
	connConfig, err := pgx.ParseConfig(*dbURL)
	if err != nil {
		log.Fatalf("❌ Failed to parse connection string: %v", err)
	}

	db := stdlib.OpenDB(*connConfig)
	defer db.Close()

	// 3. Mount the migration instance drivers
	driver, err := pgxmigrate.WithInstance(db, &pgxmigrate.Config{})
	if err != nil {
		log.Fatalf("❌ Could not create migration driver instance: %v", err)
	}

	m, err := migrate.NewWithDatabaseInstance(
		"file://./internal/database/migrations",
		"postgres",
		driver,
	)
	if err != nil {
		log.Fatalf("❌ Failed to map migration registry: %v", err)
	}

	// 4. Route execution actions
	switch *action {
	case "version":
		v, dirty, err := m.Version()
		if err != nil && !errors.Is(err, migrate.ErrNilVersion) {
			log.Fatalf("❌ Failed to read version: %v", err)
		}
		fmt.Printf("📊 Current DB Version: %d | Is Dirty: %t\n", v, dirty)

	case "force":
		if *version == 0 {
			log.Fatalf("❌ Error: -version timestamp must be supplied when forcing state transitions.")
		}
		if err := m.Force(*version); err != nil {
			log.Fatalf("❌ Force flag modification failed: %v", err)
		}
		fmt.Printf("✅ Database version forced cleanly to: %d (Dirty state dropped)\n", *version)

	case "down":
		fmt.Println("⚠️ Reverting the last migration execution step...")
		// Steps back by exactly 1 file block
		if err := m.Steps(-1); err != nil {
			if errors.Is(err, migrate.ErrNoChange) {
				fmt.Println("ℹ️ No migrations left to step down.")
				return
			}
			log.Fatalf("❌ Rollback execution block crashed: %v", err)
		}
		fmt.Println("📉 Successfully rolled back the last migration schema! 🎉")

	default:
		fmt.Printf("❌ Unknown action: %s. Use 'down', 'force', or 'version'\n", *action)
	}
}
