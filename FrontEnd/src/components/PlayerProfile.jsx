import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as d3 from 'd3';

const API_BASE_URL = 'http://localhost:3001/api'; // Ensure port is correct

function PlayerProfile() {
    const [scorerName, setScorerName] = useState('');
    const [startYear, setStartYear] = useState('');
    const [endYear, setEndYear] = useState('');
    const [scorerList, setScorerList] = useState([]);
    const [yearList, setYearList] = useState([]); // Use scoring years
    const [timelineData, setTimelineData] = useState([]);
    const [summaryData, setSummaryData] = useState(null);
    const [loadingTimeline, setLoadingTimeline] = useState(false);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [error, setError] = useState(null);
    const d3Container = useRef(null);

    // Fetch dropdown lists
    useEffect(() => {
        axios.get(`${API_BASE_URL}/distinct-scorers`)
            .then(response => setScorerList(response.data || []))
            .catch(err => console.error("Error fetching scorer list:", err));
        axios.get(`${API_BASE_URL}/distinct-scoring-years`)
            .then(response => setYearList(response.data || []))
            .catch(err => console.error("Error fetching scoring year list:", err));
    }, []);

    // Fetch timeline and summary data when scorer or year range changes
    useEffect(() => {
        if (!scorerName) {
            setTimelineData([]);
            setSummaryData(null);
            setError(null);
            return; // Don't fetch if no scorer is selected
        }

        const fetchPlayerData = async () => {
            setLoadingTimeline(true);
            setLoadingSummary(true);
            setError(null);

            const timelineParams = new URLSearchParams({ scorerName });
            if (startYear) timelineParams.append('startYear', startYear);
            if (endYear) timelineParams.append('endYear', endYear);

            const summaryParams = new URLSearchParams({ scorer_name: scorerName, limit: 1 }); // Fetch only the selected scorer

            try {
                const [timelineRes, summaryRes] = await Promise.all([
                    axios.get(`${API_BASE_URL}/player-goal-timeline?${timelineParams.toString()}`),
                    axios.get(`${API_BASE_URL}/scorer-summary?${summaryParams.toString()}`)
                ]);

                // Process timeline data - fill missing years with 0 goals
                const rawTimeline = timelineRes.data.data || [];
                const minYear = startYear ? parseInt(startYear) : (rawTimeline.length > 0 ? d3.min(rawTimeline, d => d.year) : null);
                const maxYear = endYear ? parseInt(endYear) : (rawTimeline.length > 0 ? d3.max(rawTimeline, d => d.year) : null);

                if (minYear !== null && maxYear !== null) {
                    const yearMap = new Map(rawTimeline.map(d => [d.year, d.goals_scored]));
                    const filledTimeline = [];
                    for (let y = minYear; y <= maxYear; y++) {
                        filledTimeline.push({ year: y, goals_scored: yearMap.get(y) || 0 });
                    }
                    setTimelineData(filledTimeline);
                } else {
                    setTimelineData(rawTimeline.sort((a, b) => a.year - b.year)); // Sort if no range given
                }


                setSummaryData(summaryRes.data.data?.[0] || null); // Get the first (only) result

            } catch (err) {
                console.error("Error fetching player data:", err);
                setError("Failed to load player data.");
                setTimelineData([]);
                setSummaryData(null);
            } finally {
                setLoadingTimeline(false);
                setLoadingSummary(false);
            }
        };

        fetchPlayerData();
    }, [scorerName, startYear, endYear]);

    // D3 Line Chart for Goal Timeline
    useEffect(() => {
        if (timelineData.length > 0 && d3Container.current) {
            const svg = d3.select(d3Container.current);
            svg.selectAll("*").remove();

            const margin = { top: 20, right: 30, bottom: 40, left: 50 };
            const width = 600 - margin.left - margin.right;
            const height = 300 - margin.top - margin.bottom;

            const chart = svg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            // X axis - Year (Linear scale for timeline)
            const x = d3.scaleLinear()
                .domain(d3.extent(timelineData, d => d.year))
                .range([0, width]);
            chart.append("g")
                .attr("transform", `translate(0, ${height})`)
                .call(d3.axisBottom(x).tickFormat(d3.format("d"))); // Format as integer

            // Y axis - Goals Scored
            const y = d3.scaleLinear()
                .domain([0, d3.max(timelineData, d => d.goals_scored) || 1])
                .range([height, 0]);
            chart.append("g")
                .call(d3.axisLeft(y));

            // Line generator
            const line = d3.line()
                .x(d => x(d.year))
                .y(d => y(d.goals_scored));

            // Draw the line
            chart.append("path")
                .datum(timelineData)
                .attr("fill", "none")
                .attr("stroke", "steelblue")
                .attr("stroke-width", 1.5)
                .attr("d", line);

            // Add points
            chart.selectAll("dot")
                .data(timelineData)
                .enter().append("circle")
                .attr("cx", d => x(d.year))
                .attr("cy", d => y(d.goals_scored))
                .attr("r", 3)
                .attr("fill", "steelblue");

            // Add Axis Labels
            svg.append("text")
                .attr("text-anchor", "middle")
                .attr("x", margin.left + width / 2)
                .attr("y", height + margin.top + 35)
                .text("Year");

            svg.append("text")
                .attr("text-anchor", "middle")
                .attr("transform", "rotate(-90)")
                .attr("y", margin.left - 35)
                .attr("x", - (margin.top + height / 2))
                .text("Goals Scored");

        } else if (d3Container.current) {
            // Clear SVG if no data
            d3.select(d3Container.current).selectAll("*").remove();
        }
    }, [timelineData]); // Re-render chart when timelineData changes

    const handleScorerChange = (event) => setScorerName(event.target.value);
    const handleStartYearChange = (event) => setStartYear(event.target.value);
    const handleEndYearChange = (event) => setEndYear(event.target.value);

    const isLoading = loadingTimeline || loadingSummary;

    return (
        <div>
            <h3>Player Profile & Goal Timeline</h3>
            <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                    <label>Scorer: </label>
                    <select value={scorerName} onChange={handleScorerChange}>
                        <option value="">-- Select Scorer --</option>
                        {scorerList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label>Year Range: </label>
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

            {isLoading && <p>Loading player data...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}

            {!isLoading && !error && scorerName && (
                <>
                    {/* Summary Section */}
                    {summaryData ? (
                        <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc' }}>
                            <h4>{summaryData.scorer_name} - Summary</h4>
                            <p><strong>Total Goals:</strong> {summaryData.total_goals}</p>
                            <p><strong>Scoring Years:</strong> {summaryData.first_scoring_year} - {summaryData.last_scoring_year}</p>
                            <p><strong>Max Goals in a Match:</strong> {summaryData.max_goals_in_match}</p>
                        </div>
                    ) : (
                        <p>No summary data available for this player.</p>
                    )}

                    {/* Timeline Chart Section */}
                    <h4>Goal Timeline ({startYear || 'First'} - {endYear || 'Last'})</h4>
                    {timelineData.length > 0 ? (
                         <>
                            <svg ref={d3Container} width={600} height={300}></svg>
                            {/* Timeline Table */}
                            <div style={{ marginTop: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                                <table border="1" style={{ borderCollapse: 'collapse', width: '95%' }}>
                                    <thead>
                                        <tr>
                                            <th>Year</th>
                                            <th>Goals Scored</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {timelineData.map(d => (
                                            <tr key={d.year}>
                                                <td>{d.year}</td>
                                                <td>{d.goals_scored}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <p>No goal data found for the selected period.</p>
                    )}
                </>
            )}
            {!scorerName && <p>Please select a scorer to view their profile.</p>}
        </div>
    );
}

export default PlayerProfile;
