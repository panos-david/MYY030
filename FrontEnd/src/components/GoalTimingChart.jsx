import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as d3 from 'd3';

const API_BASE_URL = 'http://localhost:3001/api'; // Adjust if needed

function GoalTimingChart() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const d3Container = useRef(null);
    const [startYear, setStartYear] = useState('');
    const [endYear, setEndYear] = useState('');
    const [tournamentFilter, setTournamentFilter] = useState('');
    const [tournamentList, setTournamentList] = useState([]); // For tournament dropdown
    const [yearList, setYearList] = useState([]);           // For year dropdowns

    // Fetch dropdown data
    useEffect(() => {
        axios.get(`${API_BASE_URL}/distinct-tournaments`)
            .then(response => setTournamentList(response.data || []))
            .catch(err => console.error("Error fetching tournament list:", err));
        axios.get(`${API_BASE_URL}/distinct-match-years`) // Use match years for this view
            .then(response => setYearList(response.data || []))
            .catch(err => console.error("Error fetching match year list:", err));
    }, []);

    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams();
        if (startYear) params.append('startYear', startYear);
        if (endYear) params.append('endYear', endYear);
        if (tournamentFilter) params.append('tournament', tournamentFilter);

        axios.get(`${API_BASE_URL}/goal-timing?${params.toString()}`)
            .then(response => {
                // Sort data logically by time segment if backend doesn't guarantee order
                const sortedData = (response.data.data || []).sort((a, b) => {
                    // Basic sort logic, assumes segments start with numbers or have a pattern
                    const numA = parseInt(a.time_segment.match(/\d+/)?.[0] || '999');
                    const numB = parseInt(b.time_segment.match(/\d+/)?.[0] || '999');
                    return numA - numB;
                });
                setData(sortedData);
                setError(null);
            })
            .catch(err => {
                console.error("Error fetching goal timing:", err);
                setError("Failed to load goal timing data.");
                setData([]);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [startYear, endYear, tournamentFilter]);

    useEffect(() => {
        if (data.length > 0 && d3Container.current) {
            const svg = d3.select(d3Container.current);
            svg.selectAll("*").remove();

            const margin = { top: 20, right: 30, bottom: 60, left: 60 }; // Adjusted margins
            const width = 500 - margin.left - margin.right;
            const height = 400 - margin.top - margin.bottom;

            const chart = svg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            // X axis - Time Segment
            const x = d3.scaleBand()
                .domain(data.map(d => d.time_segment))
                .range([0, width])
                .padding(0.2);
            chart.append("g")
                .attr("transform", `translate(0, ${height})`)
                .call(d3.axisBottom(x))
                .selectAll("text")
                .attr("transform", "translate(-10,0)rotate(-45)")
                .style("text-anchor", "end");

            // Y axis - Count
            const y = d3.scaleLinear()
                .domain([0, d3.max(data, d => d.count) || 1])
                .range([height, 0]);
            chart.append("g")
                .call(d3.axisLeft(y));

            // Bars
            chart.selectAll("myRect")
                .data(data)
                .join("rect")
                .attr("x", d => x(d.time_segment))
                .attr("y", d => y(d.count))
                .attr("width", x.bandwidth())
                .attr("height", d => height - y(d.count))
                .attr("fill", "#a05d56"); // Different color

             // Add X axis label
            svg.append("text")
                .attr("text-anchor", "end")
                .attr("x", width / 2 + margin.left)
                .attr("y", height + margin.top + 55) // Adjust position
                .text("Time Segment");

            // Add Y axis label
            svg.append("text")
                .attr("text-anchor", "end")
                .attr("transform", "rotate(-90)")
                .attr("y", margin.left - 45) // Adjust position
                .attr("x", -height / 2 - margin.top)
                .text("Number of Goals");

        }
    }, [data]);

    const handleStartYearChange = (event) => setStartYear(event.target.value);
    const handleEndYearChange = (event) => setEndYear(event.target.value);
    const handleTournamentFilterChange = (event) => setTournamentFilter(event.target.value);

    return (
        <div>
            <h3>Goal Timing Distribution</h3>
             {/* Filter Controls */}
            <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                 <div>
                    <label>Tournament: </label>
                    {/* Tournament Dropdown */}
                    <select value={tournamentFilter} onChange={handleTournamentFilterChange}>
                        <option value="">-- All Tournaments --</option>
                        {tournamentList.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div>
                    <label>Year Range: </label>
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
            </div>

            {loading && <p>Loading chart...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <svg ref={d3Container} width={500} height={400}></svg>
        </div>
    );
}

export default GoalTimingChart;
