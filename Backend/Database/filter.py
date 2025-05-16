import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import numpy as np  # For NaN handling
import os           # For file path handling


def truncate_all(conn_params):
    """
    Truncates all relevant tables before insertion, 
    resetting their SERIAL primary keys and cascading dependencies.
    """
    with psycopg2.connect(**conn_params) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                TRUNCATE TABLE 
                    penalty_shootouts,
                    goals,
                    matches,
                    former_names,
                    countries
                RESTART IDENTITY CASCADE;
            """)
            conn.commit()


def clean_countries(path):
    df = pd.read_csv(path, encoding='ISO-8859-1')
    df = df.dropna(subset=['Display_Name'])
    df = df.drop_duplicates(subset=['Display_Name'])
    df['Developed or Developing'] = df['Developed or Developing'].fillna('Unknown')
    df['Status'] = df['Status'].fillna('Unknown')
    df['Area_SqKm'] = df['Area_SqKm'].fillna(0).astype(int)
    df['Population'] = df['Population'].fillna(0).astype(int)

    column_mapping = {
        'ISO': 'iso',
        'ISO3': 'iso3',
        'ISO_Code': 'iso_code',
        'FIPS': 'fips',
        'Display_Name': 'display_name',
        'Official_Name': 'official_name',
        'Capital': 'capital',
        'Continent': 'continent',
        'CurrencyCode': 'currency_code',
        'CurrencyName': 'currency_name',
        'Phone': 'phone',
        'Region Code': 'region_code',
        'Region Name': 'region_name',
        'Sub-region Code': 'sub_region_code',
        'Sub-region Name': 'sub_region_name',
        'Intermediate Region Code': 'intermediate_region_code',
        'Intermediate Region Name': 'intermediate_region_name',
        'Status': 'status',
        'Developed or Developing': 'developed_or_developing',
        'Area_SqKm': 'area_sq_km',
        'Population': 'population'
    }

    df = df.rename(columns=column_mapping)
    return df


def clean_former_names(path):
    df = pd.read_csv(path, encoding='ISO-8859-1')
    df = df.rename(columns={
        'current': 'current_country_name',
        'former': 'former_name'
    })
    df['start_date'] = pd.to_datetime(df['start_date'], errors='coerce')
    df['end_date'] = pd.to_datetime(df['end_date'], errors='coerce')
    df = df.dropna(subset=['current_country_name', 'former_name'])
    return df


def clean_shootouts(path):
    df = pd.read_csv(path, encoding='ISO-8859-1')
    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    df = df.dropna(subset=['date', 'home_team', 'away_team', 'winner'])
    return df


def clean_goalscorers(path):
    df = pd.read_csv(path, encoding='ISO-8859-1')
    df['date'] = pd.to_datetime(df['date'], errors='coerce')

    df = df.dropna(subset=['date', 'scorer', 'team', 'home_team', 'away_team'])
    df['minute'] = pd.to_numeric(df['minute'], errors='coerce').fillna(0).astype(int)

    df['own_goal'] = df['own_goal'].apply(
        lambda x: str(x).strip().lower() == 'true' if pd.notna(x) else False
    ).astype(bool)
    df['penalty'] = df['penalty'].apply(
        lambda x: str(x).strip().lower() == 'true' if pd.notna(x) else False
    ).astype(bool)

    initial_len = len(df)
    df = df.drop_duplicates(
        subset=['date', 'home_team', 'away_team', 'team', 'scorer', 'minute', 'own_goal', 'penalty']
    )
    if len(df) < initial_len:
        print(f"ℹ️ Removed {initial_len - len(df)} duplicate rows from goalscorers data.")

    return df


def clean_results(path):
    df = pd.read_csv(path, encoding='ISO-8859-1')
    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    df = df.dropna(subset=['date', 'home_team', 'away_team'])
    df['home_score'] = pd.to_numeric(df['home_score'], errors='coerce').fillna(0).astype(int)
    df['away_score'] = pd.to_numeric(df['away_score'], errors='coerce').fillna(0).astype(int)

    df['neutral'] = df['neutral'].apply(
        lambda x: str(x).strip().lower() == 'true' if pd.notna(x) else False
    ).astype(bool)

    df['country'] = df['country'].fillna('Unknown')
    return df


def add_virtual_countries(countries_df, *team_sets):
    known_countries = set(countries_df['display_name'])
    all_teams = set().union(*team_sets)
    missing_teams = all_teams - known_countries

    virtual_entries = []
    for team in sorted(missing_teams):
        virtual_entries.append({
            'display_name': team,
            'official_name': team,
            'status': 'Unrecognized',
            'developed_or_developing': 'Unknown',
            'area_sq_km': 0,
            'population': 0
        })

    virtual_df = pd.DataFrame(virtual_entries)
    combined_df = pd.concat([countries_df, virtual_df], ignore_index=True)
    return combined_df


def check_consistency(countries_df, results_df, goalscorers_df, shootouts_df, former_names_df):
    """Checks if all team/country names referenced in data exist in the countries list."""
    known_teams = set(countries_df['display_name'])

    results_teams = set(results_df['home_team']).union(set(results_df['away_team'])).union(set(results_df['country']))
    goalscorer_teams = set(goalscorers_df['team'])
    shootout_teams = set(shootouts_df['home_team']).union(set(shootouts_df['away_team'])) \
                    .union(set(shootouts_df['winner'])).union(set(shootouts_df['first_shooter'].dropna()))
    former_names_teams = set(former_names_df['current_country_name'])

    all_teams_in_data = results_teams.union(goalscorer_teams).union(shootout_teams).union(former_names_teams)

    unknown_teams = all_teams_in_data - known_teams - {'Unknown'}

    if unknown_teams:
        print(f"⚠️ Found {len(unknown_teams)} unknown teams/countries not in countries.csv:")
        print("These teams might cause mapping errors if not added as virtual countries.")
    else:
        print("✅ All teams/countries referenced in data are known or will be added as virtual.")


def insert_to_postgres(df, table_name, conn_params, allowed_columns=None):
    """Inserts a DataFrame into a PostgreSQL table, handling type conversions."""
    cols_to_insert = allowed_columns if allowed_columns else df.columns
    df_insert = df[[col for col in cols_to_insert if col in df.columns]].copy()

    for col in df_insert.columns:
        if df_insert[col].dtype in [np.int64, np.int32, np.int16, np.int8]:
            df_insert[col] = df_insert[col].apply(lambda x: int(x) if pd.notna(x) else None)
        elif df_insert[col].dtype in [np.float64, np.float32]:
            df_insert[col] = df_insert[col].apply(lambda x: float(x) if pd.notna(x) else None)
        elif df_insert[col].dtype == 'datetime64[ns]':
            df_insert[col] = df_insert[col].apply(lambda x: x.date() if pd.notna(x) else None)
        elif pd.api.types.is_integer_dtype(df_insert[col]) and df_insert[col].isna().any():
            df_insert[col] = df_insert[col].apply(lambda x: int(x) if pd.notna(x) else None)

    df_insert = df_insert.replace({pd.NA: None, np.nan: None})

    with psycopg2.connect(**conn_params) as conn:
        with conn.cursor() as cur:
            columns = ','.join([f'"{col}"' for col in df_insert.columns])
            values = [tuple(row) for row in df_insert.values.tolist()]

            sql = f"INSERT INTO {table_name} ({columns}) VALUES %s"
            try:
                execute_values(cur, sql, values)
                conn.commit()
            except psycopg2.Error as e:
                print(f"❌ Error inserting data into {table_name}: {e}")
                if values:
                    print(f"SQL example: {cur.mogrify(sql, [values[0]])}")
                conn.rollback()
            except Exception as e:
                print(f"❌ Unexpected error inserting data into {table_name}: {e}")
                conn.rollback()


def get_match_id_map(conn_params):
    """Fetches match details and IDs from the database to create a mapping."""
    query = """
        SELECT m.match_id, m.match_date,
               hc.display_name as home_team_name,
               ac.display_name as away_team_name
        FROM matches m
        JOIN countries hc ON m.home_team_id = hc.country_id
        JOIN countries ac ON m.away_team_id = ac.country_id
    """
    with psycopg2.connect(**conn_params) as conn:
        matches_df = pd.read_sql(query, conn)

    matches_df['match_date'] = pd.to_datetime(matches_df['match_date'])

    match_map = {}
    for _, row in matches_df.iterrows():
        key = (row['match_date'], row['home_team_name'], row['away_team_name'])
        match_map[key] = row['match_id']

    print(f"Fetched {len(match_map)} match IDs for mapping.")
    return match_map


def report_virtual_countries(conn_params):
    query = '''
        SELECT "display_name", "status", "developed_or_developing"
        FROM countries
        WHERE "status" = 'Unrecognized'
           OR "developed_or_developing" = 'Unknown'
    '''
    with psycopg2.connect(**conn_params) as conn:
        df = pd.read_sql(query, conn)
        print("\n🟡 Virtual/Unrecognized Countries:")
        print(df)


if __name__ == "__main__":
    data_path = "./"
    quarantine_path = os.path.join(data_path, "quarantine")
    os.makedirs(quarantine_path, exist_ok=True)

    print("🔄 Loading and cleaning data...")
    countries_raw = clean_countries(os.path.join(data_path, "countries.csv"))
    former_names_raw = clean_former_names(os.path.join(data_path, "former_names.csv"))
    shootouts_raw = clean_shootouts(os.path.join(data_path, "shootouts.csv"))
    goalscorers_raw = clean_goalscorers(os.path.join(data_path, "goalscorers.csv"))
    results_raw = clean_results(os.path.join(data_path, "results.csv"))
    print("✅ Data loaded and cleaned.")

    print("\n🔄 Identifying teams/countries and adding virtual entries...")
    results_teams = set(results_raw['home_team']).union(results_raw['away_team']).union(results_raw['country'])
    goalscorer_teams = set(goalscorers_raw['team'])
    shootout_teams = set(shootouts_raw['home_team']).union(shootouts_raw['away_team']) \
                     .union(shootouts_raw['winner']).union(shootouts_raw['first_shooter'].dropna())
    former_names_teams = set(former_names_raw['current_country_name'])

    all_teams = results_teams.union(goalscorer_teams).union(shootout_teams).union(former_names_teams) - {'Unknown'}

    countries_processed = add_virtual_countries(countries_raw, all_teams)
    print(f"Total countries including virtual: {len(countries_processed)}")

    check_consistency(countries_processed, results_raw, goalscorers_raw, shootouts_raw, former_names_raw)

    conn_info = {
        'host': 'localhost',
        'port': 5432,
        'dbname': 'MYE030',
        'user': 'postgres',
        'password': 'root'
    }

    print("\n🔄 Truncating all tables to avoid duplicates...")
    truncate_all(conn_info)
    print("✅ Tables truncated.")

    print("\n🔄 Inserting countries...")
    allowed_country_cols = [
        "iso", "iso3", "iso_code", "fips", "display_name", "official_name", "capital",
        "continent", "currency_code", "currency_name", "phone", "region_code", "region_name",
        "sub_region_code", "sub_region_name", "intermediate_region_code", "intermediate_region_name",
        "status", "developed_or_developing", "sids", "lldc", "ldc", "area_sq_km", "population"
    ]
    for col in ['sids', 'lldc', 'ldc']:
        if col in countries_processed.columns:
            countries_processed[col] = countries_processed[col].apply(
                lambda x: str(x).lower() == 'true' if pd.notna(x) else False
            ).astype(bool)

    insert_to_postgres(countries_processed, 'countries', conn_info, allowed_columns=allowed_country_cols)
    print("✅ Countries inserted.")

    print("\n🔄 Fetching country IDs from database...")
    with psycopg2.connect(**conn_info) as conn:
        countries_with_ids = pd.read_sql('SELECT country_id, display_name FROM countries', conn)
    country_id_map = countries_with_ids.set_index('display_name')['country_id'].to_dict()
    country_id_map['Unknown'] = None
    print(f"✅ Fetched {len(country_id_map)-1} country IDs (+1 placeholder).")

    print("\n🔄 Processing and inserting former names...")
    former_names_to_insert = former_names_raw.copy()
    former_names_to_insert['country_id'] = former_names_to_insert['current_country_name'].map(country_id_map)

    original_len = len(former_names_to_insert)
    former_names_to_insert = former_names_to_insert.dropna(subset=['country_id'])
    if len(former_names_to_insert) < original_len:
        print(f"⚠️ Dropped {original_len - len(former_names_to_insert)} former names due to missing country mapping.")

    former_names_final = former_names_to_insert[['country_id', 'former_name', 'start_date', 'end_date']].copy()
    former_names_final['country_id'] = former_names_final['country_id'].astype(int)

    insert_to_postgres(former_names_final, 'former_names', conn_info)
    print("✅ Former names inserted.")

    print("\n🔄 Processing and inserting matches...")
    matches_to_insert = results_raw.copy()
    matches_to_insert['home_team_id'] = matches_to_insert['home_team'].map(country_id_map)
    matches_to_insert['away_team_id'] = matches_to_insert['away_team'].map(country_id_map)
    matches_to_insert['country_id'] = matches_to_insert['country'].map(country_id_map)

    original_len = len(matches_to_insert)
    matches_to_insert = matches_to_insert.dropna(subset=['home_team_id', 'away_team_id'])
    if len(matches_to_insert) < original_len:
        print(f"⚠️ Dropped {original_len - len(matches_to_insert)} matches due to missing home/away team mapping.")

    matches_final = matches_to_insert.rename(columns={'date': 'match_date'})
    matches_final['home_team_id'] = matches_final['home_team_id'].astype(int)
    matches_final['away_team_id'] = matches_final['away_team_id'].astype(int)
    matches_final['country_id'] = matches_final['country_id'].astype('Int64')

    match_cols_for_db = [
        'match_date', 'home_team_id', 'away_team_id', 'home_score', 'away_score',
        'tournament', 'city', 'country_id', 'neutral'
    ]
    matches_final = matches_final[match_cols_for_db]

    initial_match_count = len(matches_final)
    matches_final = matches_final.drop_duplicates(subset=['match_date', 'home_team_id', 'away_team_id'])
    if len(matches_final) < initial_match_count:
        print(f"ℹ️ Removed {initial_match_count - len(matches_final)} duplicate match entries.")

    insert_to_postgres(matches_final, 'matches', conn_info)
    print("✅ Matches inserted.")

    print("\n🔄 Fetching match IDs for mapping goals and shootouts...")
    match_id_map = get_match_id_map(conn_info)

    print("\n🔄 Processing and inserting goals...")
    goals_to_insert = goalscorers_raw.copy()
    goals_to_insert['match_key'] = list(zip(goals_to_insert['date'], goals_to_insert['home_team'], goals_to_insert['away_team']))
    goals_to_insert['match_id'] = goals_to_insert['match_key'].map(match_id_map)
    goals_to_insert['team_id'] = goals_to_insert['team'].map(country_id_map)

    original_len = len(goals_to_insert)
    goals_to_insert = goals_to_insert.dropna(subset=['match_id', 'team_id'])
    if len(goals_to_insert) < original_len:
        print(f"⚠️ Dropped {original_len - len(goals_to_insert)} goals due to missing match/team mapping.")

    goals_final = goals_to_insert.copy()
    goals_final['match_id'] = goals_final['match_id'].astype(int)
    goals_final['team_id'] = goals_final['team_id'].astype(int)

    goal_cols_for_db = ['match_id', 'team_id', 'scorer', 'minute', 'own_goal', 'penalty']
    goals_final = goals_final[goal_cols_for_db]

    initial_goal_count = len(goals_final)
    goals_final = goals_final.drop_duplicates(subset=goal_cols_for_db)
    if len(goals_final) < initial_goal_count:
        print(f"ℹ️ Removed {initial_goal_count - len(goals_final)} duplicate goal entries.")

    insert_to_postgres(goals_final, 'goals', conn_info)
    print("✅ Goals inserted.")

    print("\n🔄 Processing and inserting penalty shootouts...")
    shootouts_to_insert = shootouts_raw.copy()
    shootouts_to_insert['match_key'] = list(zip(shootouts_to_insert['date'], shootouts_to_insert['home_team'], shootouts_to_insert['away_team']))
    shootouts_to_insert['match_id'] = shootouts_to_insert['match_key'].map(match_id_map)
    shootouts_to_insert['winner_id'] = shootouts_to_insert['winner'].map(country_id_map)
    shootouts_to_insert['first_shooter_id'] = shootouts_to_insert['first_shooter'].map(country_id_map)

    orphaned_shootouts = shootouts_to_insert[
        shootouts_to_insert['match_id'].isna() | shootouts_to_insert['winner_id'].isna()
    ].copy()
    if not orphaned_shootouts.empty:
        quarantine_file = os.path.join(quarantine_path, "quarantined_shootouts.csv")
        print(f"⚠️ Found {len(orphaned_shootouts)} orphaned shootout records. Saving to {quarantine_file}")
        orphaned_shootouts.to_csv(quarantine_file, index=False, encoding='utf-8')

    original_len = len(shootouts_to_insert)
    shootouts_to_insert = shootouts_to_insert.dropna(subset=['match_id', 'winner_id'])
    if len(shootouts_to_insert) < original_len:
        print(f"ℹ️ Excluded {original_len - len(shootouts_to_insert)} shootouts due to missing match/winner mapping.")

    shootouts_final = shootouts_to_insert.copy()
    shootouts_final['match_id'] = shootouts_final['match_id'].astype(int)
    shootouts_final['winner_id'] = shootouts_final['winner_id'].astype(int)
    shootouts_final['first_shooter_id'] = shootouts_final['first_shooter_id'].astype('Int64')

    shootout_cols_for_db = ['match_id', 'winner_id', 'first_shooter_id']
    shootouts_final = shootouts_final[shootout_cols_for_db]

    initial_shootout_count = len(shootouts_final)
    shootouts_final = shootouts_final.drop_duplicates(subset=['match_id'])
    if len(shootouts_final) < initial_shootout_count:
        print(f"ℹ️ Removed {initial_shootout_count - len(shootouts_final)} duplicate shootout entries based on match_id.")

    insert_to_postgres(shootouts_final, 'penalty_shootouts', conn_info)
    print("✅ Penalty shootouts inserted.")

    report_virtual_countries(conn_info)

    print("\n🎉 Database population complete.")
