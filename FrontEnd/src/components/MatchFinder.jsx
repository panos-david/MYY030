import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

function MatchFinder() {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        team: '',
        homeTeam: '',
        awayTeam: '',
        tournament: '',
        startYear: '',
        endYear: '',
        city: '',
        country: ''
    });
    const [pagination, setPagination] = useState({ limit: 50, offset: 0, totalPages: 1 });
    const [currentPage, setCurrentPage] = useState(1);
    const [countryList, setCountryList] = useState([]);
    const [tournamentList, setTournamentList] = useState([]);
    const [cityList, setCityList] = useState([]); 
    const [yearList, setYearList] = useState([]);

    useEffect(() => {
        axios.get(`${API_BASE_URL}/distinct-countries`)
            .then(response => setCountryList(response.data || []))
            .catch(err => console.error("Error fetching country list:", err));

        axios.get(`${API_BASE_URL}/distinct-tournaments`)
            .then(response => setTournamentList(response.data || []))
            .catch(err => console.error("Error fetching tournament list:", err));

        axios.get(`${API_BASE_URL}/distinct-cities`)
            .then(response => setCityList(response.data || []))
            .catch(err => console.error("Error fetching city list:", err));

        axios.get(`${API_BASE_URL}/distinct-match-years`)
            .then(response => setYearList(response.data || []))
            .catch(err => console.error("Error fetching match year list:", err));
    }, []);

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const fetchMatches = (page = 1) => {
        setLoading(true);
        const offset = (page - 1) * pagination.limit;
        const params = new URLSearchParams({
            limit: pagination.limit,
            offset: offset,
            sort: 'match_date:desc'
        });
        for (const key in filters) {
            if (filters[key]) {
                params.append(key, filters[key]);
            }
        }

        axios.get(`${API_BASE_URL}/match-list?${params.toString()}`)
            .then(response => {
                setMatches(response.data.data || []);
                setPagination(response.data.pagination || { limit: 50, offset: 0, totalPages: 1 });
                setCurrentPage(page);
                setError(null);
            })
            .catch(err => {
                console.error("Error fetching matches:", err);
                setError("Failed to load matches.");
                setMatches([]);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchMatches(1); 
    };

     const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchMatches(newPage);
        }
    };

    useEffect(() => {
        // fetchMatches or set up logic so it's not called repeatedly
    }, []);

    return (
        <div>
            <h3>Match Finder</h3>
            <form onSubmit={handleSearch} style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select name="team" value={filters.team} onChange={handleFilterChange}>
                    <option value="">-- Team (Home or Away) --</option>
                    {countryList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select name="homeTeam" value={filters.homeTeam} onChange={handleFilterChange}>
                    <option value="">-- Home Team --</option>
                    {countryList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select name="awayTeam" value={filters.awayTeam} onChange={handleFilterChange}>
                    <option value="">-- Away Team --</option>
                    {countryList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select name="tournament" value={filters.tournament} onChange={handleFilterChange}>
                    <option value="">-- Tournament --</option>
                    {tournamentList.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select name="startYear" value={filters.startYear} onChange={handleFilterChange}>
                     <option value="">From Year</option>
                     {yearList.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select name="endYear" value={filters.endYear} onChange={handleFilterChange}>
                     <option value="">To Year</option>
                     {yearList.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select name="city" value={filters.city} onChange={handleFilterChange}>
                    <option value="">-- All Cities --</option>
                    {cityList.map(city => <option key={city} value={city}>{city}</option>)}
                </select>
                 <select name="country" value={filters.country} onChange={handleFilterChange}>
                    <option value="">-- Match Country --</option>
                    {countryList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button type="submit" disabled={loading}>
                    {loading ? 'Searching...' : 'Search Matches'}
                </button>
            </form>

            {error && <p style={{ color: 'red' }}>{error}</p>}

            {matches.length > 0 && !loading && (
                 <div>
                    <h4>Matches Found ({pagination.totalItems})</h4>
                     <div style={{ margin: '10px 0' }}>
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1}>Previous</button>
                        <span> Page {currentPage} of {pagination.totalPages} </span>
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= pagination.totalPages}>Next</button>
                    </div>
                    <table border="1" style={{ borderCollapse: 'collapse', width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Tournament</th>
                                <th>Home Team</th>
                                <th>Away Team</th>
                                <th>Score</th>
                                <th>City</th>
                                <th>Country</th>
                                <th>Neutral</th>
                            </tr>
                        </thead>
                        <tbody>
                            {matches.map((match, idx) => (
                                // Render 
                                <tr key={idx}>
                                    <td>{new Date(match.match_date).toLocaleDateString()}</td>
                                    <td>{match.tournament}</td>
                                    <td>{match.home_team}</td>
                                    <td>{match.away_team}</td>
                                    <td>{match.home_score} - {match.away_score}</td>
                                    <td>{match.city}</td>
                                    <td>{match.country}</td>
                                    <td>{match.neutral ? 'Yes' : 'No'}</td>
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
             {!loading && matches.length === 0 && <p>No matches found for the specified criteria. Use the filters and click Search.</p>}
        </div>
    );
}

export default MatchFinder;
