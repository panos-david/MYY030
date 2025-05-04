-- Drop tables in reverse order of dependency if they exist
DROP TABLE IF EXISTS penalty_shootouts;
DROP TABLE IF EXISTS goals;
DROP TABLE IF EXISTS former_names;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS countries;

-- Create countries table first as others depend on it
CREATE TABLE countries (
    country_id SERIAL PRIMARY KEY,
    iso VARCHAR(2),
    iso3 VARCHAR(3),
    iso_code INT,
    fips VARCHAR(2),
    display_name VARCHAR(255) NOT NULL UNIQUE, -- Ensure display_name is unique
    official_name VARCHAR(255),
    capital VARCHAR(255),
    continent VARCHAR(50),
    currency_code VARCHAR(3),
    currency_name VARCHAR(100),
    phone VARCHAR(50),
    region_code VARCHAR(10),
    region_name VARCHAR(100),
    sub_region_code VARCHAR(10),
    sub_region_name VARCHAR(100),
    intermediate_region_code VARCHAR(10),
    intermediate_region_name VARCHAR(100),
    status VARCHAR(50),
    developed_or_developing VARCHAR(50),
    sids BOOLEAN,
    lldc BOOLEAN,
    ldc BOOLEAN,
    area_sq_km INT,
    population BIGINT -- Use BIGINT for potentially large populations
);

-- Create matches table with foreign keys and unique constraint
CREATE TABLE matches (
    match_id SERIAL PRIMARY KEY,
    match_date DATE NOT NULL,
    home_team_id INT NOT NULL REFERENCES countries(country_id),
    away_team_id INT NOT NULL REFERENCES countries(country_id),
    home_score INT NOT NULL,
    away_score INT NOT NULL,
    tournament VARCHAR(255),
    city VARCHAR(255),
    country_id INT REFERENCES countries(country_id), -- Host country
    neutral BOOLEAN NOT NULL,
    -- Add constraint to prevent duplicate matches on the same date between the same teams
    CONSTRAINT unique_match UNIQUE (match_date, home_team_id, away_team_id)
);

-- Create former_names table
CREATE TABLE former_names (
    former_name_id SERIAL PRIMARY KEY,
    country_id INT NOT NULL REFERENCES countries(country_id),
    former_name VARCHAR(255) NOT NULL,
    start_date DATE,
    end_date DATE
);

-- Create goals table
CREATE TABLE goals (
    goal_id SERIAL PRIMARY KEY,
    match_id INT NOT NULL REFERENCES matches(match_id),
    team_id INT NOT NULL REFERENCES countries(country_id), -- Team that scored
    scorer VARCHAR(255),
    minute INT,
    own_goal BOOLEAN NOT NULL DEFAULT FALSE,
    penalty BOOLEAN NOT NULL DEFAULT FALSE
    -- Optional: Add a unique constraint if needed, e.g., on (match_id, minute, scorer, team_id)
    -- CONSTRAINT unique_goal UNIQUE (match_id, minute, scorer, team_id) -- Be careful with this, might be too strict
);

-- Create penalty_shootouts table
CREATE TABLE penalty_shootouts (
    shootout_id SERIAL PRIMARY KEY,
    match_id INT NOT NULL UNIQUE REFERENCES matches(match_id), -- Each match has at most one shootout
    winner_id INT NOT NULL REFERENCES countries(country_id),
    first_shooter_id INT REFERENCES countries(country_id) -- Can be NULL if unknown
);

-- Optional: Add indexes for frequently queried columns
CREATE INDEX idx_matches_date ON matches(match_date);
CREATE INDEX idx_matches_home_team ON matches(home_team_id);
CREATE INDEX idx_matches_away_team ON matches(away_team_id);
CREATE INDEX idx_goals_match_id ON goals(match_id);
CREATE INDEX idx_goals_scorer ON goals(scorer);
CREATE INDEX idx_goals_team_id ON goals(team_id);
