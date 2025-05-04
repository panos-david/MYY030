import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as d3 from 'd3';

const API_BASE_URL = 'http://localhost:3001/api'; // Adjust if needed

function CountryProfileChart() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const d3Container = useRef(null);
    const [sortConfig, setSortConfig] = useState({ key: 'total_score', direction: 'desc' });
    const [limit, setLimit] = useState(10);
    const [startYear, setStartYear] = useState('');
    const [endYear, setEndYear] = useState('');
    const [countryFilter, setCountryFilter] = useState('');
    const [countryList, setCountryList] = useState([]); // For country dropdown
    const [yearList, setYearList] = useState([]);       // For year dropdowns

    // Fetch dropdown data
    useEffect(() => {
        axios.get(`${API_BASE_URL}/distinct-countries`)
            .then(response => setCountryList(response.data || []))
            .catch(err => console.error("Error fetching country list:", err));
        axios.get(`${API_BASE_URL}/distinct-active-years`) // Use active years for this view
            .then(response => setYearList(response.data || []))
            .catch(err => console.error("Error fetching active year list:", err));
    }, []);

    useEffect(() => {
        setLoading(true);
        const sortParam = `${sortConfig.key}:${sortConfig.direction}`;
        // Build query parameters including filters
        const params = new URLSearchParams({
            sort: sortParam,
            limit: limit,
        });
        if (startYear) params.append('startYear', startYear);
        if (endYear) params.append('endYear', endYear);
        if (countryFilter) params.append('country_name', countryFilter); // Use backend filter key

        axios.get(`${API_BASE_URL}/country-profiles?${params.toString()}`)
            .then(response => {
                setData(response.data.data || []); // Access data property
                setError(null);
            })
            .catch(err => {
                console.error("Error fetching country profiles:", err);
                setError("Failed to load country profiles.");
                setData([]);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [sortConfig, limit, startYear, endYear, countryFilter]); // Re-fetch when filters change

    useEffect(() => {
        if (data.length > 0 && d3Container.current) {
            const svg = d3.select(d3Container.current);
            svg.selectAll("*").remove();

            const margin = { top: 20, right: 30, bottom: 100, left: 120 }; // Increased bottom/left margin
            const width = 600 - margin.left - margin.right;
            const height = 400 - margin.top - margin.bottom;

            const chart = svg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            const x = d3.scaleLinear()
                .domain([0, d3.max(data, d => d[sortConfig.key]) || 1]) // Use dynamic key, ensure domain > 0
                .range([0, width]);
            chart.append("g")
                .attr("transform", `translate(0, ${height})`)
                .call(d3.axisBottom(x))
                .selectAll("text")
                .attr("transform", "translate(-10,0)rotate(-45)")
                .style("text-anchor", "end");

            const y = d3.scaleBand()
                .range([0, height])
                .domain(data.map(d => d.country_name))
                .padding(.1);
            chart.append("g")
                .call(d3.axisLeft(y));

            chart.selectAll("myRect")
                .data(data)
                .join("rect")
                .attr("x", x(0))
                .attr("y", d => y(d.country_name))
                .attr("width", d => x(d[sortConfig.key]))
                .attr("height", y.bandwidth())
                .attr("fill", "#69b3a2");

            // Add X axis label
            svg.append("text")
                .attr("text-anchor", "end")
                .attr("x", width / 2 + margin.left)
                .attr("y", height + margin.top + 60) // Adjust position
                .text(sortConfig.key.replace(/_/g, ' ')); // Label based on sorted key

            // Add Y axis label
            svg.append("text")
                .attr("text-anchor", "end")
                .attr("transform", "rotate(-90)")
                .attr("y", margin.left - 100) // Adjust position
                .attr("x", -height / 2 - margin.top)
                .text("Country");

        }
    }, [data, sortConfig.key]); // Re-render D3 chart if data or sorted key changes

    const handleSortChange = (event) => {
        const newKey = event.target.value;
        setSortConfig(prev => ({ key: newKey, direction: prev.direction }));
    };

    const handleDirectionChange = (event) => {
        const newDirection = event.target.value;
        setSortConfig(prev => ({ key: prev.key, direction: newDirection }));
    };

     const handleLimitChange = (event) => {
        const newLimit = Math.max(1, parseInt(event.target.value) || 10); // Ensure positive integer
        setLimit(newLimit);
    };

    // Handlers for new filters
    const handleStartYearChange = (event) => setStartYear(event.target.value);
    const handleEndYearChange = (event) => setEndYear(event.target.value);
    const handleCountryFilterChange = (event) => setCountryFilter(event.target.value);

    // Available sort keys from the view
    const sortKeys = [
        'total_score', 'wins', 'draws', 'losses', 'matches_played', 'goals_scored',
        'goals_conceded', 'goal_difference', 'distinct_years_played',
        'wins_per_active_year', 'score_per_active_year'
    ];

    // Avoid multiple fetch calls causing repeated data
    useEffect(() => {
        // ...existing code...
    }, []);

    // Render country profile data only once
    return (
        <div>
            <h3>Country Profiles</h3>
            {/* Filter Controls */}
            <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                 <div>
                    <label>Country: </label>
                    {/* Country Dropdown */}
                    <select value={countryFilter} onChange={handleCountryFilterChange}>
                        <option value="">-- All Countries --</option>
                        {countryList.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label>Years Active: </label>
                    {/* Year Dropdowns */}
                    <select value={startYear} onChange={handleStartYearChange}>
                         <option value="">From Year</option>
                         {yearList.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <span> - </span>
                     <select value={endYear} onChange={handleEndYearChange}>
                         <option value="">To Year</option>
                         {yearList.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                 <div>|</div>
                <div>
                    <label>Sort by: </label>
                    <select value={sortConfig.key} onChange={handleSortChange}>
                        {sortKeys.map(key => (
                            <option key={key} value={key}>{key.replace(/_/g, ' ')}</option>
                        ))}
                    </select>
                    <select value={sortConfig.direction} onChange={handleDirectionChange}>
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                    </select>
                </div>
                <div>
                    <label> Limit: </label>
                    <input type="number" value={limit} onChange={handleLimitChange} min="1" style={{width: "50px"}}/>
                </div>
            </div>
            {loading && <p>Loading chart...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <svg ref={d3Container} width={600} height={400}></svg>
            {/* Optional: Display more stats below chart */}
            {data.length > 0 && !loading && (
                <div style={{ marginTop: '20px' }}>
                    <h4>Details for Top {limit} ({sortConfig.key.replace(/_/g, ' ')})</h4>
                    <table border="1" style={{ borderCollapse: 'collapse', width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Country</th>
                                <th>Played</th>
                                <th>Wins</th>
                                <th>Draws</th>
                                <th>Losses</th>
                                <th>GF</th>
                                <th>GA</th>
                                <th>GD</th>
                                <th>Score</th>
                                <th>Years Active</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map(country => (
                                <tr key={country.country_id}>
                                    <td>{country.country_name}</td>
                                    <td>{country.matches_played}</td>
                                    <td>{country.wins}</td>
                                    <td>{country.draws}</td>
                                    <td>{country.losses}</td>
                                    <td>{country.goals_scored}</td>
                                    <td>{country.goals_conceded}</td>
                                    <td>{country.goal_difference}</td>
                                    <td>{country.total_score}</td>
                                    <td>{country.first_year_active}-{country.last_year_active} ({country.distinct_years_played})</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default CountryProfileChart;
