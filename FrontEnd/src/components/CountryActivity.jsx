import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api'; // Ensure port is correct

function CountryActivity() {
    const [countryName, setCountryName] = useState('');
    const [countryList, setCountryList] = useState([]);
    const [activityData, setActivityData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch country list
    useEffect(() => {
        axios.get(`${API_BASE_URL}/distinct-countries`)
            .then(response => setCountryList(response.data || []))
            .catch(err => console.error("Error fetching country list:", err));
    }, []);

    // Fetch activity data when country changes
    useEffect(() => {
        if (!countryName) {
            setActivityData(null);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);
        axios.get(`${API_BASE_URL}/country-activity?countryName=${encodeURIComponent(countryName)}`)
            .then(response => {
                setActivityData(response.data.data || null);
            })
            .catch(err => {
                console.error("Error fetching country activity:", err);
                setError(`Failed to load activity data for ${countryName}.`);
                setActivityData(null);
            })
            .finally(() => {
                setLoading(false);
            });

    }, [countryName]);

    const handleCountryChange = (event) => setCountryName(event.target.value);

    return (
        <div>
            <h3>Country Activity Years</h3>
            <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div>
                    <label>Country: </label>
                    <select value={countryName} onChange={handleCountryChange}>
                        <option value="">-- Select Country --</option>
                        {countryList.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            {loading && <p>Loading activity data...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}

            {!loading && !error && countryName && (
                activityData ? (
                    <div>
                        <p><strong>First Year Active:</strong> {activityData.first_year_active}</p>
                        <p><strong>Last Year Active:</strong> {activityData.last_year_active}</p>
                        <p><strong>Distinct Years Played:</strong> {activityData.distinct_years_played}</p>
                    </div>
                ) : (
                    <p>No activity data found for {countryName}.</p>
                )
            )}
             {!countryName && <p>Please select a country.</p>}
        </div>
    );
}

export default CountryActivity;
