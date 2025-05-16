import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

function PlayerGoalSearch() {
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [scorerName, setScorerName] = useState('');
    const [startYear, setStartYear] = useState('');
    const [endYear, setEndYear] = useState('');
    const [tournament, setTournament] = useState('');
    const [tournamentList, setTournamentList] = useState([]);
    const [scorerList, setScorerList] = useState([]);
    const [pagination, setPagination] = useState({ limit: 50, offset: 0, totalPages: 1 });
    const [currentPage, setCurrentPage] = useState(1);
    const [searchAttempted, setSearchAttempted] = useState(false);

    useEffect(() => {
        axios.get(`${API_BASE_URL}/distinct-tournaments`)
            .then(response => setTournamentList(response.data || []))
            .catch(err => console.error("Error fetching tournament list:", err));

        axios.get(`${API_BASE_URL}/distinct-scorers`)
            .then(response => setScorerList(response.data || []))
            .catch(err => console.error("Error fetching scorer list:", err));
    }, []);

    const fetchGoals = (page = 1) => {
        setLoading(true);
        setSearchAttempted(true);
        const offset = (page - 1) * pagination.limit;
        const params = new URLSearchParams({
            limit: pagination.limit,
            offset: offset,
            sort: 'match_date:desc,scorer:asc'
        });
        if (scorerName) params.append('scorerName', scorerName);
        if (startYear) params.append('startYear', startYear);
        if (endYear) params.append('endYear', endYear);
        if (tournament) params.append('tournament', tournament);

        axios.get(`${API_BASE_URL}/player-goals?${params.toString()}`)
            .then(response => {
                setGoals(response.data.data || []);
                setPagination(response.data.pagination || { limit: 50, offset: 0, totalPages: 1 });
                setCurrentPage(page);
                setError(null);
            })
            .catch(err => {
                console.error("Error fetching player goals:", err);
                setError(`Failed to load goals.`);
                setGoals([]);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    const handleSearch = (e) => {
        e.preventDefault(); 
        fetchGoals(1);
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchGoals(newPage);
        }
    };

    return (
        <div>
            <h3>Player Goal Finder</h3>
            <form onSubmit={handleSearch} style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={scorerName} onChange={(e) => setScorerName(e.target.value)}>
                    <option value="">-- Select Scorer (Optional) --</option>
                    {scorerList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                <input type="number" value={startYear} onChange={(e) => setStartYear(e.target.value)} placeholder="From Year" style={{ width: '100px' }} />
                <input type="number" value={endYear} onChange={(e) => setEndYear(e.target.value)} placeholder="To Year" style={{ width: '100px' }} />

                <select value={tournament} onChange={(e) => setTournament(e.target.value)}>
                    <option value="">-- Select Tournament (Optional) --</option>
                    {tournamentList.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button type="submit" disabled={loading}>
                    {loading ? 'Searching...' : 'Search Goals'}
                </button>
            </form>

            {error && <p style={{ color: 'red' }}>{error}</p>}


            {!loading && goals.length > 0 && (
                <div>
                    <h4>Goals Found ({pagination.totalItems})</h4>
                     <div style={{ margin: '10px 0' }}>
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1}>Previous</button>
                        <span> Page {currentPage} of {pagination.totalPages} </span>
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= pagination.totalPages}>Next</button>
                    </div>
                    <table border="1" style={{ borderCollapse: 'collapse', width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Scorer</th>
                                <th>Date</th>
                                <th>Tournament</th>
                                <th>Match</th>
                                <th>Score</th>
                                <th>Team</th>
                                <th>Minute</th>
                                <th>Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            {goals.filter((_, index) => index % 6 === 0).map(goal => (
                                <tr key={`${goal.goal_id}-${goal.scorer}-${goal.minute}`}>
                                    <td>{goal.scorer}</td>
                                    <td>{new Date(goal.match_date).toLocaleDateString()}</td>
                                    <td>{goal.tournament}</td>
                                    <td>{goal.home_team} vs {goal.away_team}</td>
                                    <td>{goal.home_score} - {goal.away_score}</td>
                                    <td>{goal.scoring_team}</td>
                                    <td>{goal.minute}'</td>
                                    <td>{goal.own_goal ? 'Own Goal' : (goal.penalty ? 'Penalty' : 'Goal')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     <div style={{ margin: '10px 0' }}>
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1}>Previous</button>
                        <span> Page {currentPage} of {pagination.totalPages} </span>
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= pagination.totalPages}>Next</button>
                    </div>
                </div>
            )}
             {!loading && searchAttempted && goals.length === 0 && <p>No goals found for the specified criteria.</p>}
        </div>
    );
}

export default PlayerGoalSearch;
