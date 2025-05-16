import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as d3 from 'd3';

const API_BASE_URL = 'http://localhost:3001/api';

function ScorerSummaryChart() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const d3Container = useRef(null);
    const [sortConfig, setSortConfig] = useState({ key: 'total_goals', direction: 'desc' });
    const [limit, setLimit] = useState(15);
    const [startYear, setStartYear] = useState('');
    const [endYear, setEndYear] = useState('');
    const [scorerFilter, setScorerFilter] = useState('');
    const [scorerList, setScorerList] = useState([]);
    const [yearList, setYearList] = useState([]);

    useEffect(() => {
        axios.get(`${API_BASE_URL}/distinct-scorers`)
            .then(response => setScorerList(response.data || []))
            .catch(err => console.error("Error fetching scorer list:", err));
        axios.get(`${API_BASE_URL}/distinct-scoring-years`)
            .then(response => setYearList(response.data || []))
            .catch(err => console.error("Error fetching scoring year list:", err));
    }, []);

    useEffect(() => {
        setLoading(true);
        const sortParam = `${sortConfig.key}:${sortConfig.direction}`;
        const params = new URLSearchParams({
            sort: sortParam,
            limit: limit,
        });
        if (startYear) params.append('startYear', startYear);
        if (endYear) params.append('endYear', endYear);
        if (scorerFilter) params.append('scorer_name', scorerFilter);

        axios.get(`${API_BASE_URL}/scorer-summary?${params.toString()}`)
            .then(response => {
                setData(response.data.data || []);
                setError(null);
            })
            .catch(err => {
                console.error("Error fetching scorer summary:", err);
                setError("Failed to load scorer summary.");
                setData([]);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [sortConfig, limit, startYear, endYear, scorerFilter]);

    useEffect(() => {
        if (data.length > 0 && d3Container.current) {
            const svg = d3.select(d3Container.current);
            svg.selectAll("*").remove();

            const margin = { top: 20, right: 30, bottom: 100, left: 120 };
            const width = 600 - margin.left - margin.right;
            const height = 400 - margin.top - margin.bottom;

            const chart = svg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            const x = d3.scaleLinear()
                .domain([0, d3.max(data, d => d[sortConfig.key]) || 1])
                .range([0, width]);
            chart.append("g")
                .attr("transform", `translate(0, ${height})`)
                .call(d3.axisBottom(x))
                .selectAll("text")
                .attr("transform", "translate(-10,0)rotate(-45)")
                .style("text-anchor", "end");

            const y = d3.scaleBand()
                .range([0, height])
                .domain(data.map(d => d.scorer_name))
                .padding(.1);
            chart.append("g")
                .call(d3.axisLeft(y));

            chart.selectAll("myRect")
                .data(data)
                .join("rect")
                .attr("x", x(0))
                .attr("y", d => y(d.scorer_name))
                .attr("width", d => x(d[sortConfig.key]))
                .attr("height", y.bandwidth())
                .attr("fill", "#ff7f0e");
            svg.append("text")
                .attr("text-anchor", "end")
                .attr("x", width / 2 + margin.left)
                .attr("y", height + margin.top + 60)
                .text(sortConfig.key.replace(/_/g, ' '));

            svg.append("text")
                .attr("text-anchor", "end")
                .attr("transform", "rotate(-90)")
                .attr("y", margin.left - 100)
                .attr("x", -height / 2 - margin.top)
                .text("Scorer");
        }
    }, [data, sortConfig.key]);

    const handleSortChange = (event) => setSortConfig(prev => ({ key: event.target.value, direction: prev.direction }));
    const handleDirectionChange = (event) => setSortConfig(prev => ({ key: prev.key, direction: event.target.value }));
    const handleLimitChange = (event) => setLimit(Math.max(1, parseInt(event.target.value) || 10));
    const handleStartYearChange = (event) => setStartYear(event.target.value);
    const handleEndYearChange = (event) => setEndYear(event.target.value);
    const handleScorerFilterChange = (event) => setScorerFilter(event.target.value);

    const sortKeys = ['total_goals', 'first_scoring_year', 'last_scoring_year', 'max_goals_in_match'];

    return (
        <div>
            <h3>Scorer Summary</h3>
            <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                    <label>Scorer: </label>
                    <select value={scorerFilter} onChange={handleScorerFilterChange}>
                        <option value="">-- All Scorers --</option>
                        {scorerList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label>Scoring Years: </label>
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
                        {sortKeys.map(key => <option key={key} value={key}>{key.replace(/_/g, ' ')}</option>)}
                    </select>
                    <select value={sortConfig.direction} onChange={handleDirectionChange}>
                        <option value="asc">Asc</option>
                        <option value="desc">Desc</option>
                    </select>
                </div>
                <div>
                    <label> Limit: </label>
                    <input type="number" value={limit} onChange={handleLimitChange} min="1" style={{ width: "50px" }} />
                </div>
            </div>
            {loading && <p>Loading chart...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <svg ref={d3Container} width={600} height={400}></svg>
             {data.length > 0 && !loading && (
                <div style={{ marginTop: '20px' }}>
                    <h4>Details for Top {limit} Scorers ({sortConfig.key.replace(/_/g, ' ')})</h4>
                    <table border="1" style={{ borderCollapse: 'collapse', width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Scorer</th>
                                <th>Total Goals</th>
                                <th>First Year</th>
                                <th>Last Year</th>
                                <th>Max / Match</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map(scorer => (
                                <tr key={scorer.scorer_name}>
                                    <td>{scorer.scorer_name}</td>
                                    <td>{scorer.total_goals}</td>
                                    <td>{scorer.first_scoring_year}</td>
                                    <td>{scorer.last_scoring_year}</td>
                                    <td>{scorer.max_goals_in_match}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default ScorerSummaryChart;
