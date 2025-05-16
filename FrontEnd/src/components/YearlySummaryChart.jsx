import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as d3 from 'd3';

const API_BASE_URL = 'http://localhost:3001/api';

function YearlySummaryChart() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const d3Container = useRef(null);
    const [startYear, setStartYear] = useState('');
    const [endYear, setEndYear] = useState('');
    const [continent, setContinent] = useState('');
    const [continentList, setContinentList] = useState([]);

    useEffect(() => {
        axios.get(`${API_BASE_URL}/distinct-continents`)
            .then(response => setContinentList(response.data || []))
            .catch(err => console.error("Error fetching continent list:", err));
    }, []);

    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams({ sort: 'year:asc' });
        if (startYear) params.append('startYear', startYear);
        if (endYear) params.append('endYear', endYear);
        if (continent) params.append('continent', continent);

        axios.get(`${API_BASE_URL}/yearly-summary?${params.toString()}`)
            .then(response => {
                const aggregatedData = aggregateYearlyData(response.data.data || []);
                setData(aggregatedData);
                setError(null);
            })
            .catch(err => {
                console.error("Error fetching yearly summary:", err);
                setError("Failed to load yearly summary.");
                setData([]);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [startYear, endYear, continent]);

    const aggregateYearlyData = (rawData) => {
        const yearMap = new Map();
        rawData.forEach(item => {
            if (!yearMap.has(item.year)) {
                yearMap.set(item.year, {
                    year: item.year,
                    total_matches: 0,
                    draw_matches: 0,
                    penalty_shootout_matches: 0
                });
            }
            const yearData = yearMap.get(item.year);
            yearData.total_matches += item.total_matches;
            yearData.draw_matches += item.draw_matches;
            yearData.penalty_shootout_matches += item.penalty_shootout_matches;
        });
        return Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
    };


    useEffect(() => {
        if (data.length > 0 && d3Container.current) {

            const svg = d3.select(d3Container.current);
            svg.selectAll("*").remove();

            const margin = { top: 40, right: 120, bottom: 60, left: 60 };
            const width = 700 - margin.left - margin.right;
            const height = 400 - margin.top - margin.bottom;

            const chart = svg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            const x = d3.scaleBand()
                .domain(data.map(d => d.year))
                .range([0, width])
                .padding(0.2);
            chart.append("g")
                .attr("transform", `translate(0, ${height})`)
                .call(d3.axisBottom(x))
                .selectAll("text")
                .attr("transform", "translate(-10,0)rotate(-65)")
                .style("text-anchor", "end");

            const yMax = d3.max(data, d => d.total_matches) || 1;
            const y = d3.scaleLinear()
                .domain([0, yMax])
                .range([height, 0]);
            chart.append("g")
                .call(d3.axisLeft(y));

            chart.selectAll(".bar-total")
                .data(data)
                .join("rect")
                .attr("class", "bar-total")
                .attr("x", d => x(d.year))
                .attr("y", d => y(d.total_matches))
                .attr("width", x.bandwidth())
                .attr("height", d => height - y(d.total_matches))
                .attr("fill", "#69b3a2");

            const lineDraws = d3.line()
                .x(d => x(d.year) + x.bandwidth() / 2)
                .y(d => y(d.draw_matches));

            chart.append("path")
                .datum(data)
                .attr("fill", "none")
                .attr("stroke", "steelblue")
                .attr("stroke-width", 1.5)
                .attr("d", lineDraws);

             const linePenalties = d3.line()
                .x(d => x(d.year) + x.bandwidth() / 2)
                .y(d => y(d.penalty_shootout_matches));

            chart.append("path")
                .datum(data)
                .attr("fill", "none")
                .attr("stroke", "orange")
                .attr("stroke-width", 1.5)
                .attr("d", linePenalties);

            const legend = svg.append("g")
              .attr("font-family", "sans-serif")
              .attr("font-size", 10)
              .attr("text-anchor", "start")
              .attr("transform", `translate(${width + margin.left + 10}, ${margin.top})`); 

            legend.append("rect").attr("width", 10).attr("height", 10).attr("fill", "#69b3a2");
            legend.append("text").attr("x", 15).attr("y", 9).text("Total Matches").attr("alignment-baseline", "middle");

            legend.append("line").attr("x1", 0).attr("x2", 10).attr("y1", 25).attr("y2", 25).attr("stroke", "steelblue").attr("stroke-width", 1.5);
            legend.append("text").attr("x", 15).attr("y", 25).text("Draws").attr("alignment-baseline", "middle");

            legend.append("line").attr("x1", 0).attr("x2", 10).attr("y1", 40).attr("y2", 40).attr("stroke", "orange").attr("stroke-width", 1.5);
            legend.append("text").attr("x", 15).attr("y", 40).text("Shootouts").attr("alignment-baseline", "middle");

            svg.append("text")
                .attr("text-anchor", "middle")
                .attr("x", margin.left + width / 2)
                .attr("y", height + margin.top + 50) 
                .text("Year");

            svg.append("text")
                .attr("text-anchor", "middle")
                .attr("transform", "rotate(-90)")
                .attr("y", margin.left - 40)
                .attr("x", - (margin.top + height / 2))
                .text("Number of Matches");

        }
    }, [data]);

    const handleStartYearChange = (event) => setStartYear(event.target.value);
    const handleEndYearChange = (event) => setEndYear(event.target.value);
    const handleContinentChange = (event) => setContinent(event.target.value);

    return (
        <div>
            <h3>Yearly Match Summary (by Match Location Continent)</h3>
            <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                 <div>
                    // Labels = Dropdowns
                    <label>Year Range: </label>
                    <input type="number" value={startYear} onChange={handleStartYearChange} placeholder="From Year" style={{ width: '100px' }} />
                    <span> - </span>
                    <input type="number" value={endYear} onChange={handleEndYearChange} placeholder="To Year" style={{ width: '100px' }} />
                </div>
                 <div>
                    <label>Continent: </label>
                    <select value={continent} onChange={handleContinentChange}>
                        <option value="">-- All Continents --</option>
                        {continentList.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            {loading && <p>Loading chart...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <svg ref={d3Container} width={700} height={400}></svg>
             {data.length > 0 && !loading && (
                <div style={{ marginTop: '20px', maxHeight: '300px', overflowY: 'auto' }}>
                    <h4>Yearly Data {continent ? `(${continent})` : ''}</h4>
                    <table border="1" style={{ borderCollapse: 'collapse', width: '95%' }}>
                        <thead>
                            <tr>
                                <th>Year</th>
                                <th>Total Matches</th>
                                <th>Draws</th>
                                <th>Shootouts</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map(yearData => (
                                <tr key={yearData.year}>
                                    <td>{yearData.year}</td>
                                    <td>{yearData.total_matches}</td>
                                    <td>{yearData.draw_matches}</td>
                                    <td>{yearData.penalty_shootout_matches}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default YearlySummaryChart;
