import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import debounce from 'lodash.debounce'; // Import debounce

const API_BASE_URL = 'http://localhost:3001/api';

function PlayerAutocompleteSearch() {
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [allScorers, setAllScorers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch all scorers once on mount
    useEffect(() => {
        setLoading(true);
        axios.get(`${API_BASE_URL}/distinct-scorers`)
            .then(response => {
                setAllScorers(response.data || []);
                setError(null);
            })
            .catch(err => {
                console.error("Error fetching scorer list:", err);
                setError("Failed to load scorer list.");
                setAllScorers([]);
            })
            .finally(() => setLoading(false));
    }, []);

    // Debounced function to filter suggestions
    const debouncedFilterSuggestions = useCallback(
        debounce((value) => {
            if (!value) {
                setSuggestions([]);
                return;
            }
            const filtered = allScorers
                .filter(scorer => scorer.toLowerCase().includes(value.toLowerCase()))
                .slice(0, 10); // Limit suggestions
            setSuggestions(filtered);
        }, 300), // 300ms debounce delay
        [allScorers] // Dependency: re-create if allScorers changes
    );

    const handleInputChange = (event) => {
        const value = event.target.value;
        setInputValue(value);
        debouncedFilterSuggestions(value);
    };

    const handleSuggestionClick = (scorer) => {
        setInputValue(scorer);
        setSuggestions([]);
        // Optional: Trigger search in PlayerGoalSearch component if needed
        // This requires lifting state up or using context/global state manager
        console.log(`Selected scorer: ${scorer}`);
    };

    return (
        <div>
            <h3>Find Player by Name</h3>
            {loading && <p>Loading scorer list...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <div style={{ position: 'relative' }}>
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder="Type scorer name..."
                    style={{ width: '300px', padding: '8px' }}
                    disabled={loading || error}
                />
                {suggestions.length > 0 && (
                    <ul style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        border: '1px solid #ccc',
                        backgroundColor: 'white',
                        listStyle: 'none',
                        margin: 0,
                        padding: 0,
                        zIndex: 10,
                        maxHeight: '200px',
                        overflowY: 'auto'
                    }}>
                        {suggestions.map((scorer, index) => (
                            <li
                                key={index}
                                onClick={() => handleSuggestionClick(scorer)}
                                style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                            >
                                {scorer}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
             {/* Display selected scorer (optional) */}
             {/* {inputValue && suggestions.length === 0 && <p>Selected: {inputValue}</p>} */}
        </div>
    );
}

export default PlayerAutocompleteSearch;
