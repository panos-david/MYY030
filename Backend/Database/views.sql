-- Active: 1731590999447@@127.0.0.1@5434

-- Drop existing views if they exist (in reverse dependency order)
-- Drop views that depend on others first
DROP VIEW IF EXISTS country_profile;
DROP VIEW IF EXISTS scorer_team_activity; -- Depends on goals, matches, countries
DROP VIEW IF EXISTS scorer_summary; -- Depends on goals, matches
DROP VIEW IF EXISTS yearly_match_summary; -- Depends on matches, penalty_shootouts
DROP VIEW IF EXISTS goal_timing_distribution; -- Depends on goals, matches
DROP VIEW IF EXISTS head_to_head_stats; -- Depends on matches, countries
DROP VIEW IF EXISTS team_tournament_performance; -- Depends on matches, countries
DROP VIEW IF EXISTS goal_details; -- Depends on goals, matches, countries
DROP VIEW IF EXISTS match_details; -- Depends on matches, countries

-- Drop views that are dependencies for country_profile
DROP VIEW IF EXISTS country_activity_summary; -- Depends on matches, countries
DROP VIEW IF EXISTS country_home_stats; -- Depends on matches
DROP VIEW IF EXISTS country_away_stats; -- Depends on matches
DROP VIEW IF EXISTS country_performance; -- Depends on matches, countries

-- Drop views that are dependencies for others (if any were missed above)
DROP VIEW IF EXISTS tournament_summary; -- Depends on matches
DROP VIEW IF EXISTS player_goals_yearly; -- Add drop for new view

-- Now recreate the views in the correct dependency order

-- View: Comprehensive Match Details
-- Combines match information with team (country) names and match location country.
CREATE VIEW match_details AS
SELECT
    m.match_id,
    m.match_date,
    m.tournament, -- Tournament name directly from matches table
    EXTRACT(YEAR FROM m.match_date) AS tournament_year, -- Extract year from date
    ht.display_name AS home_team, -- Use display_name from countries table for team name
    at.display_name AS away_team, -- Use display_name from countries table for team name
    m.home_score,
    m.away_score,
    m.city AS match_city,
    mc.display_name AS match_country, -- Country where the match was played
    m.neutral
FROM
    matches m
LEFT JOIN -- Use LEFT JOIN in case country IDs are missing
    countries ht ON m.home_team_id = ht.country_id
LEFT JOIN
    countries at ON m.away_team_id = at.country_id
LEFT JOIN
    countries mc ON m.country_id = mc.country_id;

-- View: Detailed Goal Information
-- Links goals to the scorer name (VARCHAR), the match, and the scoring team (country).
CREATE VIEW goal_details AS
SELECT
    g.goal_id,
    m.match_id,
    m.tournament,
    EXTRACT(YEAR FROM m.match_date) AS tournament_year,
    m.match_date,
    g.scorer AS scorer_name, -- Scorer name directly from goals table
    scoring_team.display_name AS scoring_team,
    conceding_team.display_name AS team_conceded,
    g.minute AS goal_minute,
    g.penalty AS is_penalty, -- Use actual column name
    g.own_goal AS is_own_goal -- Use actual column name
FROM
    goals g
JOIN
    matches m ON g.match_id = m.match_id
LEFT JOIN
    countries scoring_team ON g.team_id = scoring_team.country_id
LEFT JOIN -- Determine the team conceded against by joining matches and comparing team IDs
    countries conceding_team ON (m.home_team_id = conceding_team.country_id AND g.team_id = m.away_team_id)
                             OR (m.away_team_id = conceding_team.country_id AND g.team_id = m.home_team_id);


-- View: Tournament Summary (Grouped by tournament name and year)
-- Aggregates key statistics for each tournament occurrence.
CREATE VIEW tournament_summary AS
SELECT
    m.tournament,
    EXTRACT(YEAR FROM m.match_date) AS year,
    -- Cannot determine a single host country reliably from this schema per tournament
    -- mc.display_name AS host_country, -- This would only show countries where matches were played
    COUNT(DISTINCT m.match_id) AS total_matches,
    SUM(m.home_score + m.away_score) AS total_goals,
    AVG(m.home_score + m.away_score) AS avg_goals_per_match,
    COUNT(DISTINCT CASE WHEN m.home_score <> m.away_score THEN m.match_id END) AS decisive_matches,
    COUNT(DISTINCT CASE WHEN m.home_score = m.away_score THEN m.match_id END) AS draw_matches
FROM
    matches m
-- LEFT JOIN countries mc ON m.country_id = mc.country_id -- Join if you want match location countries
GROUP BY
    m.tournament, EXTRACT(YEAR FROM m.match_date)
ORDER BY
    year DESC, m.tournament;


-- View: Country Performance Summary (Treating countries as teams)
-- Aggregates performance statistics for each country across all matches.
CREATE OR REPLACE VIEW country_performance AS -- Use CREATE OR REPLACE
WITH MatchTeams AS (
    -- Home Team Stats
    SELECT match_id, home_team_id AS team_country_id, home_score AS goals_for, away_score AS goals_against,
           CASE WHEN home_score > away_score THEN 1 ELSE 0 END AS win,
           CASE WHEN home_score = away_score THEN 1 ELSE 0 END AS draw,
           CASE WHEN home_score < away_score THEN 1 ELSE 0 END AS loss
    FROM matches WHERE home_team_id IS NOT NULL
    UNION ALL
    -- Away Team Stats
    SELECT match_id, away_team_id AS team_country_id, away_score AS goals_for, home_score AS goals_against,
           CASE WHEN away_score > home_score THEN 1 ELSE 0 END AS win,
           CASE WHEN away_score = home_score THEN 1 ELSE 0 END AS draw,
           CASE WHEN away_score < home_score THEN 1 ELSE 0 END AS loss
    FROM matches WHERE away_team_id IS NOT NULL
)
SELECT
    cy.country_id,
    cy.display_name AS country_name, -- Use display_name
    COUNT(DISTINCT mt.match_id) AS matches_played, -- Corrected: Count distinct matches
    SUM(mt.win)::INT AS wins, -- Cast to INT for clearer output
    SUM(mt.draw)::INT AS draws,
    SUM(mt.loss)::INT AS losses,
    SUM(mt.goals_for)::INT AS goals_scored,
    SUM(mt.goals_against)::INT AS goals_conceded,
    (SUM(mt.goals_for) - SUM(mt.goals_against))::INT AS goal_difference
FROM
    MatchTeams mt
JOIN
    countries cy ON mt.team_country_id = cy.country_id
GROUP BY
    cy.country_id, cy.display_name
ORDER BY
    cy.display_name;


-- View: Team Performance in Tournaments (Treating countries as teams)
-- Shows detailed performance of each country within each tournament occurrence.
CREATE VIEW team_tournament_performance AS
WITH TeamMatchStats AS (
    -- Home Team Stats
    SELECT
        m.tournament,
        EXTRACT(YEAR FROM m.match_date) AS year,
        m.home_team_id AS team_country_id,
        1 AS played,
        CASE WHEN m.home_score > m.away_score THEN 1 ELSE 0 END AS win,
        CASE WHEN m.home_score = m.away_score THEN 1 ELSE 0 END AS draw,
        CASE WHEN m.home_score < m.away_score THEN 1 ELSE 0 END AS loss,
        m.home_score AS goals_for,
        m.away_score AS goals_against
    FROM matches m WHERE m.home_team_id IS NOT NULL
    UNION ALL
    -- Away Team Stats
    SELECT
        m.tournament,
        EXTRACT(YEAR FROM m.match_date) AS year,
        m.away_team_id AS team_country_id,
        1 AS played,
        CASE WHEN m.away_score > m.home_score THEN 1 ELSE 0 END AS win,
        CASE WHEN m.away_score = m.home_score THEN 1 ELSE 0 END AS draw,
        CASE WHEN m.away_score < m.home_score THEN 1 ELSE 0 END AS loss,
        m.away_score AS goals_for,
        m.home_score AS goals_against
    FROM matches m WHERE m.away_team_id IS NOT NULL
)
SELECT
    tms.tournament,
    tms.year AS tournament_year,
    cy.display_name AS team_name, -- Use country display name as team name
    SUM(tms.played)::INT AS matches_played,
    SUM(tms.win)::INT AS wins,
    SUM(tms.draw)::INT AS draws,
    SUM(tms.loss)::INT AS losses,
    SUM(tms.goals_for)::INT AS goals_scored,
    SUM(tms.goals_against)::INT AS goals_conceded,
    (SUM(tms.goals_for) - SUM(tms.goals_against))::INT AS goal_difference
FROM
    TeamMatchStats tms
JOIN
    countries cy ON tms.team_country_id = cy.country_id
GROUP BY
    tms.tournament, tms.year, cy.display_name
ORDER BY
    tms.year DESC, tms.tournament, SUM(tms.win) DESC, (SUM(tms.goals_for) - SUM(tms.goals_against)) DESC;


-- View: Head-to-Head Match Results
-- Provides results for matches between any two specific teams (countries).
CREATE VIEW head_to_head_stats AS
SELECT
    m.match_id,
    m.tournament,
    EXTRACT(YEAR FROM m.match_date) AS tournament_year,
    m.match_date,
    ht.display_name AS team1_name, -- Use country display name
    at.display_name AS team2_name, -- Use country display name
    m.home_score AS team1_score,
    m.away_score AS team2_score,
    CASE
        WHEN m.home_score > m.away_score THEN ht.display_name
        WHEN m.away_score > m.home_score THEN at.display_name
        ELSE 'Draw'
    END AS winner_name
FROM
    matches m
LEFT JOIN
    countries ht ON m.home_team_id = ht.country_id
LEFT JOIN
    countries at ON m.away_team_id = at.country_id
WHERE
    ht.country_id IS NOT NULL AND at.country_id IS NOT NULL; -- Only include matches where both teams are known


-- View: Goal Timing Distribution
-- Categorizes goals based on the minute they were scored.
CREATE VIEW goal_timing_distribution AS
SELECT
    g.goal_id,
    m.match_id,
    m.tournament,
    EXTRACT(YEAR FROM m.match_date) AS tournament_year,
    g.minute,
    CASE
        WHEN g.minute BETWEEN 1 AND 15 THEN '01-15 min'
        WHEN g.minute BETWEEN 16 AND 30 THEN '16-30 min'
        WHEN g.minute BETWEEN 31 AND 45 THEN '31-45 min'
        -- Assuming minute > 45 in first half is injury time
        WHEN g.minute > 45 AND g.minute <= 50 THEN '45+ min (1st Half)' -- Adjust range as needed
        WHEN g.minute BETWEEN 46 AND 60 THEN '46-60 min' -- Regular second half start
        WHEN g.minute BETWEEN 61 AND 75 THEN '61-75 min'
        WHEN g.minute BETWEEN 76 AND 90 THEN '76-90 min'
         -- Assuming minute > 90 is injury time or extra time
        WHEN g.minute > 90 THEN '90+ min'
        ELSE 'Other/Unknown' -- Handle null or zero minutes if necessary
    END AS time_segment
FROM
    goals g
JOIN
    matches m ON g.match_id = m.match_id
WHERE g.minute IS NOT NULL; -- Exclude goals with unknown timing
-- Note: Aggregation (COUNT per segment) would be done in the backend query.

-- NEW VIEWS START HERE --

-- View: Country Activity Summary
-- Shows the first and last year a country participated and the total span/distinct years.
CREATE VIEW country_activity_summary AS
WITH CountryYears AS (
    SELECT home_team_id AS country_id, EXTRACT(YEAR FROM match_date) AS year FROM matches WHERE home_team_id IS NOT NULL
    UNION
    SELECT away_team_id AS country_id, EXTRACT(YEAR FROM match_date) AS year FROM matches WHERE away_team_id IS NOT NULL
)
SELECT
    cy.country_id,
    c.display_name AS country_name,
    MIN(cy.year)::INT AS first_year_active,
    MAX(cy.year)::INT AS last_year_active,
    (MAX(cy.year) - MIN(cy.year) + 1)::INT AS years_active_span,
    COUNT(DISTINCT cy.year)::INT AS distinct_years_played
FROM
    CountryYears cy
JOIN
    countries c ON cy.country_id = c.country_id
GROUP BY
    cy.country_id, c.display_name;


-- View: Country Home Statistics
-- Aggregates W/D/L/Goals specifically for home matches.
CREATE VIEW country_home_stats AS
SELECT
    m.home_team_id AS country_id,
    COUNT(m.match_id) AS home_played,
    SUM(CASE WHEN m.home_score > m.away_score THEN 1 ELSE 0 END)::INT AS home_wins,
    SUM(CASE WHEN m.home_score = m.away_score THEN 1 ELSE 0 END)::INT AS home_draws,
    SUM(CASE WHEN m.home_score < m.away_score THEN 1 ELSE 0 END)::INT AS home_losses,
    SUM(m.home_score)::INT AS home_goals_for,
    SUM(m.away_score)::INT AS home_goals_against
FROM
    matches m
WHERE m.home_team_id IS NOT NULL
GROUP BY
    m.home_team_id;

-- View: Country Away Statistics
-- Aggregates W/D/L/Goals specifically for away matches.
CREATE VIEW country_away_stats AS
SELECT
    m.away_team_id AS country_id,
    COUNT(m.match_id) AS away_played,
    SUM(CASE WHEN m.away_score > m.home_score THEN 1 ELSE 0 END)::INT AS away_wins,
    SUM(CASE WHEN m.away_score = m.home_score THEN 1 ELSE 0 END)::INT AS away_draws,
    SUM(CASE WHEN m.away_score < m.home_score THEN 1 ELSE 0 END)::INT AS away_losses,
    SUM(m.away_score)::INT AS away_goals_for,
    SUM(m.home_score)::INT AS away_goals_against
FROM
    matches m
WHERE m.away_team_id IS NOT NULL
GROUP BY
    m.away_team_id;


-- View: Detailed Country Profile
-- Combines overall performance, home/away stats, activity years, and calculates score.
CREATE OR REPLACE VIEW country_profile AS -- Use CREATE OR REPLACE
SELECT DISTINCT -- Add DISTINCT back to prevent duplicate rows
    cp.country_id,
    cp.country_name,
    cas.first_year_active,
    cas.last_year_active,
    cas.years_active_span,
    cas.distinct_years_played,
    cp.matches_played,
    cp.wins,
    cp.draws,
    cp.losses,
    cp.goals_scored,
    cp.goals_conceded,
    cp.goal_difference,
    (cp.wins * 3 + cp.draws * 1) AS total_score, -- Calculated score (3 points/win, 1 point/draw)
    COALESCE(chs.home_played, 0) AS home_played,
    COALESCE(chs.home_wins, 0) AS home_wins,
    COALESCE(chs.home_draws, 0) AS home_draws,
    COALESCE(chs.home_losses, 0) AS home_losses,
    COALESCE(chs.home_goals_for, 0) AS home_goals_for,
    COALESCE(chs.home_goals_against, 0) AS home_goals_against,
    COALESCE(caws.away_played, 0) AS away_played,
    COALESCE(caws.away_wins, 0) AS away_wins,
    COALESCE(caws.away_draws, 0) AS away_draws,
    COALESCE(caws.away_losses, 0) AS away_losses,
    COALESCE(caws.away_goals_for, 0) AS away_goals_for,
    COALESCE(caws.away_goals_against, 0) AS away_goals_against,
    -- Ratios for ranking (can be calculated here or in backend)
    CASE WHEN cas.distinct_years_played > 0 THEN cp.wins::FLOAT / cas.distinct_years_played ELSE 0 END AS wins_per_active_year,
    CASE WHEN cas.distinct_years_played > 0 THEN (cp.wins * 3 + cp.draws * 1)::FLOAT / cas.distinct_years_played ELSE 0 END AS score_per_active_year
FROM
    country_performance cp
LEFT JOIN
    country_activity_summary cas ON cp.country_id = cas.country_id
LEFT JOIN
    country_home_stats chs ON cp.country_id = chs.country_id
LEFT JOIN
    country_away_stats caws ON cp.country_id = caws.country_id;


-- View: Yearly Match Summary
-- Provides counts of total matches, draws, and matches decided by penalty shootouts per year.
-- Added continent of match location for filtering.
DROP VIEW IF EXISTS yearly_match_summary; -- Drop before recreating
CREATE VIEW yearly_match_summary AS
SELECT
    EXTRACT(YEAR FROM m.match_date) AS year,
    mc.continent, -- Continent where the match was played
    COUNT(m.match_id)::INT AS total_matches,
    SUM(CASE WHEN m.home_score = m.away_score THEN 1 ELSE 0 END)::INT AS draw_matches,
    COUNT(ps.shootout_id)::INT AS penalty_shootout_matches -- Count matches linked to shootouts
FROM
    matches m
LEFT JOIN
    penalty_shootouts ps ON m.match_id = ps.match_id
LEFT JOIN -- Join to get the continent of the match location
    countries mc ON m.country_id = mc.country_id
WHERE mc.continent IS NOT NULL -- Optionally filter out matches with unknown location continent
GROUP BY
    EXTRACT(YEAR FROM m.match_date), mc.continent
ORDER BY
    year DESC, mc.continent;


-- View: Scorer Summary (Simplified)
-- Provides total goals, first/last year scoring, and max goals in a single match per scorer.
CREATE OR REPLACE VIEW scorer_summary AS -- Use CREATE OR REPLACE
SELECT
    g.scorer AS scorer_name,
    COUNT(g.goal_id)::INT AS total_goals,
    MIN(EXTRACT(YEAR FROM m.match_date))::INT AS first_scoring_year,
    MAX(EXTRACT(YEAR FROM m.match_date))::INT AS last_scoring_year,
    -- Subquery to find max goals in any single match by this scorer
    MAX((
        SELECT COUNT(*)
        FROM goals g2
        WHERE g2.scorer = g.scorer AND g2.match_id = g.match_id AND g2.own_goal = FALSE
    ))::INT AS max_goals_in_match
FROM
    goals g
JOIN
    matches m ON g.match_id = m.match_id
WHERE g.scorer IS NOT NULL AND g.own_goal = FALSE
GROUP BY
    g.scorer
ORDER BY
    total_goals DESC;


-- View: Scorer Team Activity (Helper for complex ratio)
-- Shows goals scored by a scorer for a specific team (country) and the years they scored for that team.
CREATE VIEW scorer_team_activity AS
SELECT
    g.scorer AS scorer_name,
    g.team_id,
    c.display_name AS team_name,
    MIN(EXTRACT(YEAR FROM m.match_date))::INT AS first_year_for_team,
    MAX(EXTRACT(YEAR FROM m.match_date))::INT AS last_year_for_team,
    COUNT(g.goal_id)::INT AS goals_for_team
FROM
    goals g
JOIN
    matches m ON g.match_id = m.match_id
JOIN
    countries c ON g.team_id = c.country_id
WHERE g.scorer IS NOT NULL AND g.own_goal = FALSE AND g.team_id IS NOT NULL
GROUP BY
    g.scorer, g.team_id, c.display_name
ORDER BY
    g.scorer, goals_for_team DESC;

-- View: Player Goals Yearly (Used for Player Profile Timeline)
-- Aggregates goals scored by each player per year.
CREATE VIEW player_goals_yearly AS
SELECT
    g.scorer AS scorer_name,
    EXTRACT(YEAR FROM m.match_date)::INT AS year,
    COUNT(g.goal_id)::INT AS goals_scored
FROM
    goals g
JOIN
    matches m ON g.match_id = m.match_id
WHERE
    g.scorer IS NOT NULL AND g.own_goal = FALSE -- Exclude own goals and null scorers
GROUP BY
    g.scorer, EXTRACT(YEAR FROM m.match_date)
ORDER BY
    scorer_name, year;

