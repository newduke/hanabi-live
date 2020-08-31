package main

import (
	"context"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v4"
)

type GameActions struct{}

// These fields are described in "database_schema.sql"
type GameAction struct {
	Type   int `json:"type"`
	Target int `json:"target"`
	Value  int `json:"value"`
}

// GameActionRow mirrors the "game_actions" table row
type GameActionRow struct {
	GameID int
	Turn   int
	Type   int
	Target int
	Value  int
}

func (*GameActions) BulkInsert(gameActionRows []*GameActionRow) error {
	SQLString := `
		INSERT INTO game_actions (
			game_id,
			turn,
			type,
			target,
			value
		)
		VALUES
	`
	for _, gameActionRow := range gameActionRows {
		SQLString += "(" +
			strconv.Itoa(gameActionRow.GameID) + ", " +
			strconv.Itoa(gameActionRow.Turn) + ", " +
			strconv.Itoa(gameActionRow.Type) + ", " +
			strconv.Itoa(gameActionRow.Target) + ", " +
			strconv.Itoa(gameActionRow.Value) +
			"), "
	}
	SQLString = strings.TrimSuffix(SQLString, ", ")

	_, err := db.Exec(context.Background(), SQLString)
	return err
}

func (*GameActions) GetAll(databaseID int) ([]*GameAction, error) {
	actions := make([]*GameAction, 0)

	var rows pgx.Rows
	if v, err := db.Query(context.Background(), `
		SELECT
			type,
			target,
			value
		FROM game_actions
		WHERE game_id = $1
		ORDER BY turn
	`, databaseID); err != nil {
		return actions, err
	} else {
		rows = v
	}

	// Iterate over all of the actions and add them to a slice
	for rows.Next() {
		var action GameAction
		if err := rows.Scan(
			&action.Type,
			&action.Target,
			&action.Value,
		); err != nil {
			return actions, err
		}

		actions = append(actions, &action)
	}

	if err := rows.Err(); err != nil {
		return actions, err
	}
	rows.Close()

	return actions, nil
}
