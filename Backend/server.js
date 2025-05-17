const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;


const pool = new Pool({
  user: process.env.DB_USER || 'postgres', 
  host: process.env.DB_HOST || 'localhost', 
  database: process.env.DB_DATABASE || 'MYE030', 
  password: process.env.DB_PASSWORD || 'root', 
  port: parseInt(process.env.DB_PORT || '5432', 10), 
});


app.use(cors());
app.use(express.json());

// --- Helper Functions ---

function buildWhereClause(queryParams, allowedColumns, viewName = '') {
    let clause = '';
    const values = [];
    let paramIndex = 1;

    let yearColumn = null;
    if (viewName === 'scorer_summary') {

    } else if (viewName === 'country_profile') {
    } else {
         yearColumn = allowedColumns.includes('year') ? 'year' : allowedColumns.includes('tournament_year') ? 'tournament_year' : null;
    }


    for (const key in queryParams) {
        if (viewName === 'scorer_summary' && key === 'startYear' && !isNaN(parseInt(queryParams[key]))) {
             if (clause === '') clause += ' WHERE '; else clause += ' AND ';
             clause += `"first_scoring_year" >= $${paramIndex++}`;
             values.push(parseInt(queryParams[key]));
             continue;
        }
         if (viewName === 'scorer_summary' && key === 'endYear' && !isNaN(parseInt(queryParams[key]))) {
             if (clause === '') clause += ' WHERE '; else clause += ' AND ';
             clause += `"last_scoring_year" <= $${paramIndex++}`; 
             values.push(parseInt(queryParams[key]));
             continue;
        }

        if (viewName === 'country_profile' && key === 'startYear' && !isNaN(parseInt(queryParams[key]))) {
             if (clause === '') clause += ' WHERE '; else clause += ' AND ';
             clause += `"first_year_active" >= $${paramIndex++}`;
             values.push(parseInt(queryParams[key]));
             continue;
        }
        if (viewName === 'country_profile' && key === 'endYear' && !isNaN(parseInt(queryParams[key]))) {
             if (clause === '') clause += ' WHERE '; else clause += ' AND ';
             clause += `"last_year_active" <= $${paramIndex++}`;
             values.push(parseInt(queryParams[key]));
             continue;
        }
        if (yearColumn && key === 'startYear' && !isNaN(parseInt(queryParams[key]))) {
             if (clause === '') clause += ' WHERE '; else clause += ' AND ';
             clause += `"${yearColumn}" >= $${paramIndex++}`;
             values.push(parseInt(queryParams[key]));
             continue; 
        }
        if (yearColumn && key === 'endYear' && !isNaN(parseInt(queryParams[key]))) {
             if (clause === '') clause += ' WHERE '; else clause += ' AND ';
             clause += `"${yearColumn}" <= $${paramIndex++}`;
             values.push(parseInt(queryParams[key]));
             continue; 
        }


        if (allowedColumns.includes(key)) {
            if (key === 'continent' && typeof queryParams[key] === 'string') {
                 if (clause === '') clause += ' WHERE '; else clause += ' AND ';
                 clause += `"${key}" ILIKE $${paramIndex}`; 
                 values.push(`%${queryParams[key]}%`);
                 paramIndex++;
            } else if (typeof queryParams[key] === 'string') {
                 if (clause === '') clause += ' WHERE '; else clause += ' AND ';
                 clause += `"${key}" ILIKE $${paramIndex}`;
                 values.push(`%${queryParams[key]}%`);
                 paramIndex++;
            } else {
                 if (queryParams[key] === 'true' || queryParams[key] === 'false') {
                     clause += `"${key}" = $${paramIndex}`;
                     values.push(queryParams[key] === 'true');
                 } else {
                     clause += `"${key}" = $${paramIndex}`;
                     values.push(queryParams[key]);
                 }
                 paramIndex++;
            }
        }
    }
    return { clause, values };
}


function buildOrderByClause(sortParam, allowedColumns) {
    if (!sortParam) return '';

    const sortFields = sortParam.split(',');
    const orderByParts = [];

    sortFields.forEach(field => {
        const [column, direction = 'asc'] = field.split(':');
        const lowerDirection = direction.toLowerCase();

        if (allowedColumns.includes(column) && ['asc', 'desc'].includes(lowerDirection)) {
            orderByParts.push(`"${column}" ${lowerDirection.toUpperCase()}`);
        }
    });

    return orderByParts.length > 0 ? ` ORDER BY ${orderByParts.join(', ')}` : '';
}

// --- API Endpoints ---


app.get('/api', (req, res) => {
  res.json({ message: 'Welcome to the Football Stats API!' });
});

// --- View Endpoints ---

async function handleViewRequest(req, res, viewName, allowedFilterCols, allowedSortCols) {
    const { sort, ...filters } = req.query;
    const { clause, values } = buildWhereClause(filters, allowedFilterCols, viewName);
    const orderBy = buildOrderByClause(sort, allowedSortCols);

    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const paginationClause = ` LIMIT ${limit} OFFSET ${offset}`;


    const query = `SELECT DISTINCT * FROM ${viewName}${clause}${orderBy}${paginationClause}`; 
    const countQuery = `SELECT COUNT(*) FROM ${viewName}${clause}`;

    if (viewName === 'country_profile') {
        console.log(`[Country Profiles] Count Query: ${countQuery} with values: ${JSON.stringify(values)}`);
    }

    try {
        console.log(`Executing query: ${query} with values: ${JSON.stringify(values)}`);
        const result = await pool.query(query, values);

        const countResult = await pool.query(countQuery, values);
        const totalItems = parseInt(countResult.rows[0].count, 10);

        if (viewName === 'country_profile') {
            console.log(`[Country Profiles] Total Items Found: ${totalItems}`);
        }

        res.json({
            data: result.rows,
            pagination: {
                totalItems,
                limit,
                offset,
                totalPages: Math.ceil(totalItems / limit)
            }
        });
    } catch (err) {
        console.error(`Error executing query for ${viewName}`, err.stack);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
}

app.get('/api/match-details', (req, res) => {
    const allowedFilters = ['tournament', 'tournament_year', 'home_team', 'away_team', 'match_city', 'match_country', 'startYear', 'endYear']; 
    const allowedSorts = ['match_date', 'tournament_year', 'home_team', 'away_team', 'home_score', 'away_score'];
    handleViewRequest(req, res, 'match_details', allowedFilters, allowedSorts);
});

app.get('/api/goal-details', (req, res) => {
    const allowedFilters = ['tournament', 'tournament_year', 'scorer_name', 'scoring_team', 'team_conceded', 'is_penalty', 'is_own_goal', 'startYear', 'endYear']; 
    const allowedSorts = ['match_date', 'tournament_year', 'scorer_name', 'scoring_team', 'goal_minute'];
    handleViewRequest(req, res, 'goal_details', allowedFilters, allowedSorts);
});

app.get('/api/tournament-summary', (req, res) => {
    const allowedFilters = ['tournament', 'year', 'startYear', 'endYear']; 
    const allowedSorts = ['year', 'tournament', 'total_matches', 'total_goals', 'avg_goals_per_match'];
    handleViewRequest(req, res, 'tournament_summary', allowedFilters, allowedSorts);
});

app.get('/api/country-performance', (req, res) => {
    const allowedFilters = ['country_name'];
    const allowedSorts = ['country_name', 'matches_played', 'wins', 'draws', 'losses', 'goals_scored', 'goals_conceded', 'goal_difference'];
    handleViewRequest(req, res, 'country_performance', allowedFilters, allowedSorts);
});

app.get('/api/team-tournament-performance', (req, res) => {
    const allowedFilters = ['tournament', 'tournament_year', 'team_name', 'startYear', 'endYear']; 
    const allowedSorts = ['tournament_year', 'tournament', 'team_name', 'matches_played', 'wins', 'draws', 'losses', 'goals_scored', 'goals_conceded', 'goal_difference'];
    handleViewRequest(req, res, 'team_tournament_performance', allowedFilters, allowedSorts);
});


app.get('/api/head-to-head', async (req, res) => {
    const { team1_name, team2_name, sort, startYear, endYear } = req.query;
    if (!team1_name || !team2_name) {
        return res.status(400).json({ error: 'Both team1_name and team2_name query parameters are required.' });
    }

    const allowedSorts = ['match_date', 'tournament_year', 'team1_score', 'team2_score'];
    const orderBy = buildOrderByClause(sort, allowedSorts) || ' ORDER BY match_date DESC'; 

    let filterClause = `
        WHERE ((team1_name ILIKE $1 AND team2_name ILIKE $2)
           OR (team1_name ILIKE $2 AND team2_name ILIKE $1))
    `;
    const values = [team1_name, team2_name];
    let paramIndex = 3;

    if (startYear && !isNaN(parseInt(startYear))) {
        filterClause += ` AND "tournament_year" >= $${paramIndex++}`;
        values.push(parseInt(startYear));
    }
     if (endYear && !isNaN(parseInt(endYear))) {
        filterClause += ` AND "tournament_year" <= $${paramIndex++}`;
        values.push(parseInt(endYear));
    }


    try {
        const query = `SELECT * FROM head_to_head_stats ${filterClause} ${orderBy};`;
        const result = await pool.query(query, values);
        res.json({ data: result.rows }); 
    } catch (err) {
        console.error('Error executing head-to-head query', err.stack);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

app.get('/api/goal-timing', async (req, res) => {
    const { tournament, startYear, endYear } = req.query;
    let filterClause = '';
    const values = [];
    let paramIndex = 1;

    if (tournament) {
        filterClause += (filterClause ? ' AND' : ' WHERE') + ` tournament ILIKE $${paramIndex++}`;
        values.push(`%${tournament}%`);
    }
    if (startYear && !isNaN(parseInt(startYear))) {
        filterClause += (filterClause ? ' AND' : ' WHERE') + ` tournament_year >= $${paramIndex++}`;
        values.push(parseInt(startYear));
    }
     if (endYear && !isNaN(parseInt(endYear))) {
        filterClause += (filterClause ? ' AND' : ' WHERE') + ` tournament_year <= $${paramIndex++}`;
        values.push(parseInt(endYear));
    }

    try {
        const query = `
            SELECT time_segment, COUNT(*) as count
            FROM goal_timing_distribution
            ${filterClause}
            GROUP BY time_segment
            ORDER BY MIN(minute); -- Order segments logically
        `;
        const result = await pool.query(query, values);
        res.json({ data: result.rows });
    } catch (err) {
        console.error('Error executing goal timing query', err.stack);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

app.get('/api/country-profiles', (req, res) => {
    const allowedFilters = ['country_name', 'continent', 'region_name', 'sub_region_name', 'developed_or_developing', 'startYear', 'endYear'];
    const allowedSorts = [
        'country_name', 'continent', 'region_name', 'sub_region_name',
        'first_year_active', 'last_year_active', 'distinct_years_played',
        'matches_played', 'wins', 'draws', 'losses', 'goals_scored', 'goals_conceded',
        'goal_difference', 'total_score', 'home_wins', 'away_wins',
        'wins_per_active_year', 'score_per_active_year'
    ];
    handleViewRequest(req, res, 'country_profile', allowedFilters, allowedSorts);
});

app.get('/api/yearly-summary', (req, res) => {
    const allowedFilters = ['year', 'startYear', 'endYear'];
    const allowedSorts = ['year', /* 'continent', */ 'total_matches', 'draw_matches', 'penalty_shootout_matches'];
    handleViewRequest(req, res, 'yearly_match_summary', allowedFilters, allowedSorts);
});

app.get('/api/scorer-summary', (req, res) => {
    const allowedFilters = ['scorer_name', 'startYear', 'endYear'];
    const allowedSorts = ['scorer_name', 'total_goals', 'first_scoring_year', 'last_scoring_year', 'max_goals_in_match'];
    handleViewRequest(req, res, 'scorer_summary', allowedFilters, allowedSorts);
});

// --- Dynamic Query Endpoints ---

app.get('/api/player-goals', async (req, res) => {
    const { scorerName, startYear, endYear, tournament, sort } = req.query;

    // scorerName is no longer required
    // if (!scorerName) {
    //     return res.status(400).json({ error: 'scorerName query parameter is required.' });
    // }

    let query = `
        SELECT
            g.goal_id,
            m.match_date,
            m.tournament,
            ht.display_name AS home_team,
            at.display_name AS away_team,
            m.home_score,
            m.away_score,
            st.display_name AS scoring_team,
            g.minute,
            g.own_goal,
            g.penalty,
            g.scorer -- Include scorer name in results
        FROM goals g
        JOIN matches m ON g.match_id = m.match_id
        LEFT JOIN countries st ON g.team_id = st.country_id
        LEFT JOIN countries ht ON m.home_team_id = ht.country_id
        LEFT JOIN countries at ON m.away_team_id = at.country_id
    `;
    const values = [];
    let paramIndex = 1;
    let whereClauses = [];

    if (scorerName) {
        whereClauses.push(`g.scorer ILIKE $${paramIndex++}`);
        values.push(`%${scorerName}%`);
    }

    if (startYear && !isNaN(parseInt(startYear))) {
        whereClauses.push(`EXTRACT(YEAR FROM m.match_date) >= $${paramIndex++}`);
        values.push(parseInt(startYear));
    }
    if (endYear && !isNaN(parseInt(endYear))) {
        whereClauses.push(`EXTRACT(YEAR FROM m.match_date) <= $${paramIndex++}`);
        values.push(parseInt(endYear));
    }
    if (tournament) {
        whereClauses.push(`m.tournament ILIKE $${paramIndex++}`);
        values.push(`%${tournament}%`);
    }

    if (whereClauses.length > 0) {
        query += ' WHERE ' + whereClauses.join(' AND ');
    }

    const allowedSorts = ['match_date', 'tournament', 'minute', 'home_team', 'away_team', 'scorer'];
    const orderBy = buildOrderByClause(sort, allowedSorts) || ' ORDER BY m.match_date DESC, g.scorer ASC';
    query += orderBy;

    const limit = parseInt(req.query.limit) || 100; 
    const offset = parseInt(req.query.offset) || 0;
    const paginationClause = ` LIMIT ${limit} OFFSET ${offset}`;
    const baseQuery = query;
    query += paginationClause;


    try {
        // const prePaginationQuery = baseQuery.replace('SELECT', 'SELECT COUNT(*) FROM (SELECT g.goal_id'); // Simple count attempt
        // const prePaginationCountResult = await pool.query(prePaginationQuery + ') AS subquery', values);
        // console.log(`[Player Goals] Rows before pagination for query ${baseQuery} with values ${JSON.stringify(values)}: ${prePaginationCountResult.rows[0]?.count ?? 'Error counting'}`);

        console.log(`Executing player goals query: ${query} with values: ${values}`);
        const result = await pool.query(query, values);

        let countQuery = `
            SELECT COUNT(*)
            FROM goals g
            JOIN matches m ON g.match_id = m.match_id
        `;
        const countValues = [];
        let countParamIndex = 1;
        let countWhereClauses = [];
        if (scorerName) { countWhereClauses.push(`g.scorer ILIKE $${countParamIndex++}`); countValues.push(`%${scorerName}%`); }
        if (startYear && !isNaN(parseInt(startYear))) { countWhereClauses.push(`EXTRACT(YEAR FROM m.match_date) >= $${countParamIndex++}`); countValues.push(parseInt(startYear)); }
        if (endYear && !isNaN(parseInt(endYear))) { countWhereClauses.push(`EXTRACT(YEAR FROM m.match_date) <= $${countParamIndex++}`); countValues.push(parseInt(endYear)); }
        if (tournament) { countWhereClauses.push(`m.tournament ILIKE $${countParamIndex++}`); countValues.push(`%${tournament}%`); }

        if (countWhereClauses.length > 0) {
            countQuery += ' WHERE ' + countWhereClauses.join(' AND ');
        }

        const countResult = await pool.query(countQuery, countValues);
        const totalItems = parseInt(countResult.rows[0].count, 10);


        res.json({
             data: result.rows,
             pagination: {
                totalItems,
                limit,
                offset,
                totalPages: Math.ceil(totalItems / limit)
            }
         });
    } catch (err) {
        console.error('Error executing player goals query', err.stack);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});


app.get('/api/match-list', async (req, res) => {
    const { homeTeam, awayTeam, team, tournament, startYear, endYear, city, country, sort } = req.query;

    let query = `
        SELECT DISTINCT
            m.match_id,
            m.match_date,
            m.tournament,
            ht.display_name AS home_team,
            at.display_name AS away_team,
            m.home_score,
            m.away_score,
            m.city,
            mc.display_name AS country,
            m.neutral
        FROM matches m
        LEFT JOIN countries ht ON m.home_team_id = ht.country_id
        LEFT JOIN countries at ON m.away_team_id = at.country_id
        LEFT JOIN countries mc ON m.country_id = mc.country_id
    `;
    const values = [];
    let paramIndex = 1;
    let whereClauses = [];

    if (homeTeam) { whereClauses.push(`ht.display_name ILIKE $${paramIndex++}`); values.push(`%${homeTeam}%`); }
    if (awayTeam) { whereClauses.push(`at.display_name ILIKE $${paramIndex++}`); values.push(`%${awayTeam}%`); }
    if (team) { whereClauses.push(`(ht.display_name ILIKE $${paramIndex} OR at.display_name ILIKE $${paramIndex})`); values.push(`%${team}%`); paramIndex++; }
    if (tournament) { whereClauses.push(`m.tournament ILIKE $${paramIndex++}`); values.push(`%${tournament}%`); }
    if (startYear && !isNaN(parseInt(startYear))) { whereClauses.push(`EXTRACT(YEAR FROM m.match_date) >= $${paramIndex++}`); values.push(parseInt(startYear)); }
    if (endYear && !isNaN(parseInt(endYear))) { whereClauses.push(`EXTRACT(YEAR FROM m.match_date) <= $${paramIndex++}`); values.push(parseInt(endYear)); }
    if (city) { whereClauses.push(`m.city ILIKE $${paramIndex++}`); values.push(`%${city}%`); }
    if (country) { whereClauses.push(`mc.display_name ILIKE $${paramIndex++}`); values.push(`%${country}%`); }

    if (whereClauses.length > 0) {
        query += ' WHERE ' + whereClauses.join(' AND ');
    }

    const allowedSorts = ['match_date', 'tournament', 'home_team', 'away_team', 'home_score', 'away_score', 'city', 'country'];
    const orderBy = buildOrderByClause(sort, allowedSorts) || ' ORDER BY m.match_date DESC';
    query += orderBy;

    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const paginationClause = ` LIMIT ${limit} OFFSET ${offset}`;
    const baseQuery = query;
    query += paginationClause;

    try {
        // const prePaginationQuery = baseQuery.replace('SELECT', 'SELECT COUNT(*) FROM (SELECT m.match_id'); // Simple count attempt
        // const prePaginationCountResult = await pool.query(prePaginationQuery + ') AS subquery', values);
        // console.log(`[Match List] Rows before pagination for query ${baseQuery} with values ${JSON.stringify(values)}: ${prePaginationCountResult.rows[0]?.count ?? 'Error counting'}`);

        console.log(`Executing match list query: ${query} with values: ${values}`);
        const result = await pool.query(query, values);

        let countQuery = `
            SELECT COUNT(m.match_id)
            FROM matches m
            LEFT JOIN countries ht ON m.home_team_id = ht.country_id
            LEFT JOIN countries at ON m.away_team_id = at.country_id
            LEFT JOIN countries mc ON m.country_id = mc.country_id
        `;
         if (whereClauses.length > 0) {
             countQuery += ' WHERE ' + whereClauses.join(' AND ');
         }
        const countResult = await pool.query(countQuery, values);
        const totalItems = parseInt(countResult.rows[0].count, 10);

        res.json({
             data: result.rows,
             pagination: {
                totalItems,
                limit,
                offset,
                totalPages: Math.ceil(totalItems / limit)
            }
         });
    } catch (err) {
        console.error('Error executing match list query', err.stack);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});


app.get('/api/player-goal-timeline', async (req, res) => {
    const { scorerName, startYear, endYear } = req.query;
    console.log(`[Player Goal Timeline] Received request for scorer: ${scorerName}, startYear: ${startYear}, endYear: ${endYear}`);
    if (!scorerName) {
        console.log('[Player Goal Timeline] Error: scorerName parameter is missing.'); // Log error
        return res.status(400).json({ error: 'scorerName query parameter is required.' });
    }

    let query = `
        SELECT EXTRACT(YEAR FROM m.match_date)::int AS year,
               COUNT(*) AS goals_scored
        FROM goals g
        JOIN matches m ON g.match_id = m.match_id
        WHERE g.scorer ILIKE $1
    `;
    const values = [`%${scorerName}%`];
    let paramIndex = 2;

    if (startYear && !isNaN(parseInt(startYear))) {
        query += ` AND EXTRACT(YEAR FROM m.match_date) >= $${paramIndex++}`;
        values.push(parseInt(startYear));
    }
    if (endYear && !isNaN(parseInt(endYear))) {
        query += ` AND EXTRACT(YEAR FROM m.match_date) <= $${paramIndex++}`;
        values.push(parseInt(endYear));
    }
    query += ' GROUP BY year ORDER BY year ASC';

    try {
        console.log(`[Player Goal Timeline] Executing query: ${query} with values: ${JSON.stringify(values)}`);
        const result = await pool.query(query, values);
        console.log(`[Player Goal Timeline] Query successful, rows found: ${result.rows.length}`);
        res.json({ data: result.rows });
    } catch (err) {
        console.error('[Player Goal Timeline] Error executing query:', err.stack);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

app.get('/api/country-wdl-timeline', async (req, res) => {
    const { countryName, startYear, endYear } = req.query;
    if (!countryName) {
        return res.status(400).json({ error: 'countryName query parameter is required.' });
    }

    let query = `
        WITH MatchResults AS (
            -- Home Team Results
            SELECT
                EXTRACT(YEAR FROM m.match_date)::INT AS year,
                m.home_team_id AS team_id,
                CASE WHEN m.home_score > m.away_score THEN 1 ELSE 0 END AS win,
                CASE WHEN m.home_score = m.away_score THEN 1 ELSE 0 END AS draw,
                CASE WHEN m.home_score < m.away_score THEN 1 ELSE 0 END AS loss
            FROM matches m
            UNION ALL
            -- Away Team Results
            SELECT
                EXTRACT(YEAR FROM m.match_date)::INT AS year,
                m.away_team_id AS team_id,
                CASE WHEN m.away_score > m.home_score THEN 1 ELSE 0 END AS win,
                CASE WHEN m.away_score = m.home_score THEN 1 ELSE 0 END AS draw,
                CASE WHEN m.away_score < m.home_score THEN 1 ELSE 0 END AS loss
            FROM matches m
        )
        SELECT
            mr.year,
            SUM(mr.win) AS wins,
            SUM(mr.draw) AS draws,
            SUM(mr.loss) AS losses
        FROM MatchResults mr
        JOIN countries c ON mr.team_id = c.country_id
        WHERE c.display_name ILIKE $1
    `;
    const values = [`%${countryName}%`];
    let paramIndex = 2;

    if (startYear && !isNaN(parseInt(startYear))) {
        query += ` AND mr.year >= $${paramIndex++}`;
        values.push(parseInt(startYear));
    }
    if (endYear && !isNaN(parseInt(endYear))) {
        query += ` AND mr.year <= $${paramIndex++}`;
        values.push(parseInt(endYear));
    }
    query += ` GROUP BY mr.year ORDER BY mr.year ASC`;

    try {
        const result = await pool.query(query, values);
        res.json({ data: result.rows });
    } catch (err) {
        console.error('Error executing country WDL timeline query', err.stack);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

app.get('/api/top-countries/:metric', async (req, res) => {
    const { metric } = req.params;
    const { startYear, endYear, continent, region_name, sub_region_name } = req.query;
    const limit = 10;

    let metricColumn;
    let orderByDirection = 'DESC';
    let calculation = '';

    switch (metric) {
        case 'matches': metricColumn = 'matches_played'; break;
        case 'goals': metricColumn = 'goals_scored'; break;
        case 'wins': metricColumn = 'wins'; break;
        case 'draws': metricColumn = 'draws'; break;
        case 'losses': metricColumn = 'losses'; break;
        case 'win_ratio':
            calculation = `CASE WHEN matches_played > 0 THEN ROUND((wins::DECIMAL / matches_played) * 100, 2) ELSE 0 END`;
            metricColumn = 'win_ratio';
            break;
        default:
            return res.status(400).json({ error: 'Invalid metric specified.' });
    }

    let query = `
        SELECT DISTINCT
            cp.country_name,
            cp.matches_played AS matches,
            cp.wins,
            cp.draws,
            cp.losses,
            cp.goals_scored AS goals, -- Alias to match potential metric name
            cp.goals_conceded,
            c.continent,         -- Get continent from countries table
            c.region_name,       -- Get region from countries table
            c.sub_region_name    -- Get sub-region from countries table
            ${calculation ? `, ${calculation} AS ${metricColumn}` : ''}
        FROM country_performance cp
        JOIN countries c ON cp.country_id = c.country_id -- JOIN to filter
    `;

    const values = [];
    let paramIndex = 1;
    let whereClauses = [];

    if (continent) { whereClauses.push(`c.continent ILIKE $${paramIndex++}`); values.push(`%${continent}%`); }
    if (region_name) { whereClauses.push(`c.region_name ILIKE $${paramIndex++}`); values.push(`%${region_name}%`); }
    if (sub_region_name) { whereClauses.push(`c.sub_region_name ILIKE $${paramIndex++}`); values.push(`%${sub_region_name}%`); }


    if (whereClauses.length > 0) {
        query += ' WHERE ' + whereClauses.join(' AND ');
    }

    let orderByColumn = metricColumn;
    const columnMap = {
        'matches': 'matches_played',
        'goals': 'goals_scored',
        'wins': 'wins',
        'draws': 'draws',
        'losses': 'losses',
        'win_ratio': 'win_ratio'
    };
    if (columnMap[metric]) {
        orderByColumn = columnMap[metric];
    } else if (!calculation) {
         console.error(`[Top Countries] Unknown metric or mapping missing for: ${metric}`);
         orderByColumn = 'matches_played';
    }

    query += ` ORDER BY "${orderByColumn}" ${orderByDirection} NULLS LAST LIMIT ${limit}`;

    try {
        console.log(`Executing top countries query: ${query} with values: ${values}`);
        const result = await pool.query(query, values);
        res.json({ data: result.rows });
    } catch (err) {
        console.error(`Error executing top countries query for ${metric}`, err.stack);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

app.get('/api/country-activity', async (req, res) => {
    const { countryName } = req.query;
    if (!countryName) {
        return res.status(400).json({ error: 'countryName query parameter is required.' });
    }
    try {
        const query = `
            SELECT first_year_active, last_year_active, distinct_years_played
            FROM country_activity_summary
            WHERE country_name ILIKE $1
        `;
        const result = await pool.query(query, [`%${countryName}%`]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Country not found or no activity recorded.' });
        }
        res.json({ data: result.rows[0] });
    } catch (err) {
        console.error('Error fetching country activity', err.stack);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});


app.get('/api/distinct-tournaments', async (req, res) => {
    try {
        const result = await pool.query('SELECT DISTINCT tournament FROM matches ORDER BY tournament');
        res.json(result.rows.map(row => row.tournament));
    } catch (err) {
        console.error('Error fetching distinct tournaments', err.stack);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/distinct-countries', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT display_name
            FROM countries
            WHERE status != 'Unrecognized' -- Optional: Exclude virtual entries
            ORDER BY display_name
        `);
        res.json(result.rows.map(row => row.display_name));
    } catch (err) {
        console.error('Error fetching distinct countries', err.stack);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/distinct-scorers', async (req, res) => {
    const { q } = req.query;
    let query = `
        SELECT DISTINCT scorer
        FROM goals
        WHERE scorer IS NOT NULL AND scorer != ''
    `;
    const values = [];
    if (q) {
        query += ' AND scorer ILIKE $1';
        values.push(`%${q}%`);
    }
    query += ' ORDER BY scorer LIMIT 5000';
    try {
        const result = await pool.query(query, values);
        res.json(result.rows.map(row => row.scorer));
    } catch (err) {
        console.error('Error fetching distinct scorers', err.stack);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/distinct-cities', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT city
            FROM matches
            WHERE city IS NOT NULL AND city != ''
            ORDER BY city
        `);
        res.json(result.rows.map(row => row.city));
    } catch (err) {
        console.error('Error fetching distinct cities', err.stack);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/distinct-match-years', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT EXTRACT(YEAR FROM match_date)::INT AS year
            FROM matches
            ORDER BY year DESC
        `);
        res.json(result.rows.map(row => row.year));
    } catch (err) {
        console.error('Error fetching distinct match years', err.stack);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/distinct-scoring-years', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT year
            FROM (
                SELECT first_scoring_year AS year FROM scorer_summary
                UNION
                SELECT last_scoring_year AS year FROM scorer_summary
            ) AS years
            WHERE year IS NOT NULL
            ORDER BY year DESC
        `);
        res.json(result.rows.map(row => row.year));
    } catch (err) {
        console.error('Error fetching distinct scoring years', err.stack);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/distinct-active-years', async (req, res) => {
     try {
        const result = await pool.query(`
            SELECT DISTINCT year
            FROM (
                SELECT first_year_active AS year FROM country_profile
                UNION
                SELECT last_year_active AS year FROM country_profile
            ) AS years
            WHERE year IS NOT NULL
            ORDER BY year DESC
        `);
        res.json(result.rows.map(row => row.year));
    } catch (err) {
        console.error('Error fetching distinct active years', err.stack);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/distinct-continents', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT continent
            FROM countries
            WHERE continent IS NOT NULL AND continent != ''
            ORDER BY continent
        `);
        res.json(result.rows.map(row => row.continent));
    } catch (err) {
        console.error('Error fetching distinct continents', err.stack);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- Start Server ---
const server = app.listen(port, () => { 
  console.log(`Server listening on port ${port}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  server.close(async (err) => { 
    if (err) {
      console.error('Error closing server:', err);
      process.exit(1); 
    }
    console.log('HTTP server closed.');
    try {
      await pool.end();
      console.log('Database pool closed.');
      process.exit(0);
    } catch (poolErr) {
      console.error('Error closing database pool:', poolErr);
      process.exit(1);
    }
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err, origin) => {
  console.error(`Caught exception: ${err}\n` + `Exception origin: ${origin}`);
  process.exit(1);
});
