import './App.css';

// Import chart components (overview)
import CountryProfileChart from './components/CountryProfileChart';
import YearlySummaryChart from './components/YearlySummaryChart';
import GoalTimingChart from './components/GoalTimingChart';
import ScorerSummaryChart from './components/ScorerSummaryChart';
// Import dynamic search components
import PlayerGoalSearch from './components/PlayerGoalSearch';
import MatchFinder from './components/MatchFinder';
// Import NEW components
import PlayerProfile from './components/PlayerProfile';
import CountryWdlChart from './components/CountryWdlChart';
import GlobalTopStats from './components/GlobalTopStats';
import CountryActivity from './components/CountryActivity';
// import PlayerAutocompleteSearch from './components/PlayerAutocompleteSearch'; // Import the new component


function App() {

  return (
    <>
      <h1>Football Stats Dashboard</h1>

      {/* --- Dynamic Query Tools --- */}
      <h2>Dynamic Queries & Profiles</h2>
       {/* Removed standalone <PlayerAutocompleteSearch /> */}
       <hr />
      <div className="search-section">
        <MatchFinder />
      </div>
      <hr />
       <div className="search-section">
        <PlayerGoalSearch />
      </div>
      <hr />
       <div className="search-section">
        <PlayerProfile />
      </div>
      <hr />
       <div className="search-section">
         <CountryActivity />
       </div>
       <hr />
       <div className="chart-section">
         <CountryWdlChart />
       </div>
       <hr />


      {/* --- View-Based Charts & Global Stats --- */}
      <h2>Database View Summaries & Global Stats</h2>
       <div className="chart-section">
        <GlobalTopStats />
      </div>
      <hr />
      <div className="chart-section">
        <CountryProfileChart />
      </div>
      <hr />
      <div className="chart-section">
        <ScorerSummaryChart />
      </div>
       <hr />
      <div className="chart-section">
        <YearlySummaryChart />
      </div>
       <hr />
      <div className="chart-section">
        <GoalTimingChart />
      </div>
      {/* Add sections for other view-based components */}

    </>
  );
}

export default App;
