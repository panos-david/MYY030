import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api'; // Ensure port is correct

const metrics = [
    { key: 'matches', label: 'Matches Played' },
    { key: 'wins', label: 'Wins' },
    { key: 'draws', label: 'Draws' },
    { key: 'losses', label: 'Losses' },
    { key: 'goals', label: 'Goals Scored' },
    { key: 'win_ratio', label: 'Win Ratio (%)' },
];

function GlobalTopStats() {
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [continent, setContinent] = useState('');
    // Add year filters if needed later
    // const [startYear, setStartYear] = useState('');
    // const [endYear, setEndYear] = useState('');
    const [continentList, setContinentList] = useState([]);

    // Fetch continent list
    useEffect(() => {
        axios.get(`${API_BASE_URL}/distinct-continents`)
            .then(response => setContinentList(response.data || []))
            .catch(err => console.error("Error fetching continent list:", err));
    }, []);

    // Fetch stats for all metrics based on filters
    useEffect(() => {
        const fetchAllStats = async () => {
            setLoading(true);
            setError(null);
            const newStats = {};
            const params = new URLSearchParams();
            if (continent) params.append('continent', continent);
            // Add year params if implemented:
            // if (startYear) params.append('startYear', startYear);
            // if (endYear) params.append('endYear', endYear);

            try {
                for (const metric of metrics) {
                    const response = await axios.get(`${API_BASE_URL}/top-countries/${metric.key}?${params.toString()}`);
                    newStats[metric.key] = response.data.data || [];
                }
                setStats(newStats);
            } catch (err) {
                console.error("Error fetching top stats:", err);
                setError("Failed to load some or all top statistics.");
                setStats({}); // Clear stats on error
            } finally {
                setLoading(false);
            }
        };

        fetchAllStats();
    }, [continent]); // Re-fetch when continent changes (add year filters here if implemented)

    const handleContinentChange = (event) => setContinent(event.target.value);
    // Add handlers for year filters if implemented

    return (
        <div>
            <h3>Global Top 10 Statistics (by Country's Continent)</h3>
            <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                    <label>Continent: </label>
                    <select value={continent} onChange={handleContinentChange}>
                        <option value="">-- All Continents --</option>
                        {continentList.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                {/* Add Year filter inputs here if implemented */}
            </div>

            {loading && <p>Loading statistics...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}

            {!loading && !error && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                    {metrics.map(metric => (
                        <div key={metric.key} style={{ flex: '1 1 300px', minWidth: '250px' }}>
                            <h4>Top 10: {metric.label} {continent ? `(${continent})` : ''}</h4>
                            {(stats[metric.key] && stats[metric.key].length > 0) ? (
                                <table border="1" style={{ borderCollapse: 'collapse', width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th>Rank</th>
                                            <th>Country</th>
                                            <th>{metric.label}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats[metric.key].map((item, index) => (
                                            <tr key={item.country_name}>
                                                <td>{index + 1}</td>
                                                <td>{item.country_name}</td>
                                                <td>{item[metric.key] ?? item[metric.key.toLowerCase()]}</td>
                                                {/* Access calculated metric */}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p>No data available.</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default GlobalTopStats;
