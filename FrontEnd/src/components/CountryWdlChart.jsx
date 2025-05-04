import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as d3 from 'd3';

const API_BASE_URL = 'http://localhost:3001/api'; // Ensure port is correct

function CountryWdlChart() {
    const [countryName, setCountryName] = useState('');
    const [startYear, setStartYear] = useState('');
    const [endYear, setEndYear] = useState('');
    const [countryList, setCountryList] = useState([]);
    const [yearList, setYearList] = useState([]); // Use match years
    const [timelineData, setTimelineData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const d3Container = useRef(null);

    // Fetch dropdown lists
    useEffect(() => {
        axios.get(`${API_BASE_URL}/distinct-countries`)
            .then(response => setCountryList(response.data || []))
            .catch(err => console.error("Error fetching country list:", err));
        axios.get(`${API_BASE_URL}/distinct-match-years`)
            .then(response => setYearList(response.data || []))
            .catch(err => console.error("Error fetching match year list:", err));
    }, []);

    // Fetch timeline data
    useEffect(() => {
        if (!countryName) {
            setTimelineData([]);
            setError(null);
            return; // Don't fetch if no country is selected
        }

        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ countryName });
        if (startYear) params.append('startYear', startYear);
        if (endYear) params.append('endYear', endYear);

        axios.get(`${API_BASE_URL}/country-wdl-timeline?${params.toString()}`)
            .then(response => {
                // Fill missing years with 0 W/D/L
                const rawData = response.data.data || [];
                const minYear = startYear ? parseInt(startYear) : (rawData.length > 0 ? d3.min(rawData, d => d.year) : null);
                const maxYear = endYear ? parseInt(endYear) : (rawData.length > 0 ? d3.max(rawData, d => d.year) : null);

                if (minYear !== null && maxYear !== null) {
                    const yearMap = new Map(rawData.map(d => [d.year, d]));
                    const filledData = [];
                    for (let y = minYear; y <= maxYear; y++) {
                        filledData.push(yearMap.get(y) || { year: y, wins: 0, draws: 0, losses: 0 });
                    }
                    setTimelineData(filledData);
                } else {
                     setTimelineData(rawData.sort((a, b) => a.year - b.year)); // Sort if no range
                }
            })
            .catch(err => {
                console.error("Error fetching country WDL timeline:", err);
                setError("Failed to load country timeline data.");
                setTimelineData([]);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [countryName, startYear, endYear]);

    // D3 Line Chart
    useEffect(() => {
        if (timelineData.length > 0 && d3Container.current) {
            const svg = d3.select(d3Container.current);
            svg.selectAll("*").remove();

            const margin = { top: 40, right: 100, bottom: 40, left: 50 };
            const width = 700 - margin.left - margin.right;
            const height = 400 - margin.top - margin.bottom;

            const chart = svg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            // X axis - Year
            const x = d3.scaleLinear()
                .domain(d3.extent(timelineData, d => d.year))
                .range([0, width]);
            chart.append("g")
                .attr("transform", `translate(0, ${height})`)
                .call(d3.axisBottom(x).tickFormat(d3.format("d")));

            // Y axis - Count (Max of Wins, Draws, Losses)
            const yMax = d3.max(timelineData, d => Math.max(d.wins, d.draws, d.losses)) || 1;
            const y = d3.scaleLinear()
                .domain([0, yMax])
                .range([height, 0]);
            chart.append("g")
                .call(d3.axisLeft(y));

            // Line generators
            const lineWins = d3.line().x(d => x(d.year)).y(d => y(d.wins));
            const lineDraws = d3.line().x(d => x(d.year)).y(d => y(d.draws));
            const lineLosses = d3.line().x(d => x(d.year)).y(d => y(d.losses));

            // Draw lines
            chart.append("path").datum(timelineData).attr("fill", "none").attr("stroke", "green").attr("stroke-width", 1.5).attr("d", lineWins);
            chart.append("path").datum(timelineData).attr("fill", "none").attr("stroke", "orange").attr("stroke-width", 1.5).attr("d", lineDraws);
            chart.append("path").datum(timelineData).attr("fill", "none").attr("stroke", "red").attr("stroke-width", 1.5).attr("d", lineLosses);

            // Add Legend
            const legend = svg.append("g")
              .attr("font-family", "sans-serif")
              .attr("font-size", 10)
              .attr("text-anchor", "start")
              .attr("transform", `translate(${width + margin.left + 10}, ${margin.top})`);

            legend.append("line").attr("x1", 0).attr("x2", 10).attr("y1", 10).attr("y2", 10).attr("stroke", "green").attr("stroke-width", 1.5);
            legend.append("text").attr("x", 15).attr("y", 10).text("Wins").attr("alignment-baseline", "middle");

            legend.append("line").attr("x1", 0).attr("x2", 10).attr("y1", 25).attr("y2", 25).attr("stroke", "orange").attr("stroke-width", 1.5);
            legend.append("text").attr("x", 15).attr("y", 25).text("Draws").attr("alignment-baseline", "middle");

            legend.append("line").attr("x1", 0).attr("x2", 10).attr("y1", 40).attr("y2", 40).attr("stroke", "red").attr("stroke-width", 1.5);
            legend.append("text").attr("x", 15).attr("y", 40).text("Losses").attr("alignment-baseline", "middle");

            // Add Axis Labels
            svg.append("text").attr("text-anchor", "middle").attr("x", margin.left + width / 2).attr("y", height + margin.top + 35).text("Year");
            svg.append("text").attr("text-anchor", "middle").attr("transform", "rotate(-90)").attr("y", margin.left - 35).attr("x", - (margin.top + height / 2)).text("Count");

        } else if (d3Container.current) {
            d3.select(d3Container.current).selectAll("*").remove();
        }
    }, [timelineData]);

    const handleCountryChange = (event) => setCountryName(event.target.value);
    const handleStartYearChange = (event) => setStartYear(event.target.value);
    const handleEndYearChange = (event) => setEndYear(event.target.value);

    return (
        <div>
            <h3>Country Win/Draw/Loss Timeline</h3>
            <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                    <label>Country: </label>
                    <select value={countryName} onChange={handleCountryChange}>
                        <option value="">-- Select Country --</option>
                        {countryList.map(c => <option key={c} value={c}>{c}</option>)}
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

            {loading && <p>Loading timeline...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}

            {!loading && !error && countryName && (
                <>
                    {timelineData.length > 0 ? (
                        <>
                            <svg ref={d3Container} width={700} height={400}></svg>
                            {/* Timeline Table */}
                            <div style={{ marginTop: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                                <h4>Yearly Results for {countryName}</h4>
                                <table border="1" style={{ borderCollapse: 'collapse', width: '95%' }}>
                                    <thead>
                                        <tr>
                                            <th>Year</th>
                                            <th>Wins</th>
                                            <th>Draws</th>
                                            <th>Losses</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {timelineData.map(d => (
                                            <tr key={d.year}>
                                                <td>{d.year}</td>
                                                <td>{d.wins}</td>
                                                <td>{d.draws}</td>
                                                <td>{d.losses}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <p>No match data found for {countryName} in the selected period.</p>
                    )}
                </>
            )}
            {!countryName && <p>Please select a country.</p>}
        </div>
    );
}

export default CountryWdlChart;
