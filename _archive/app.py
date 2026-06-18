import streamlit as st
import pandas as pd
import numpy as np
from io import BytesIO
from statsmodels.tsa.holtwinters import ExponentialSmoothing
import statsmodels.api as sm

def forecast_holt_winters(df, date_col, target_col, months=6, uplift_pct=0.0, downside_pct=0.0):
    df = df.sort_values(by=date_col).copy()
    df = df.dropna(subset=[date_col, target_col])
    
    if df.empty or len(df) < 4:
        st.warning("Not enough data points to forecast (need at least 4).")
        return df
        
    df = df.groupby(date_col)[target_col].sum().reset_index()
    df = df.set_index(date_col)
    
    y = df[target_col].values
    
    seasonal_periods = 12 if len(y) >= 24 else None
    seasonal = 'add' if seasonal_periods else None
    
    try:
        model = ExponentialSmoothing(y, trend='add', seasonal=seasonal, seasonal_periods=seasonal_periods, initialization_method="estimated")
        fit_model = model.fit()
        forecast = fit_model.forecast(months)
        
        residuals = fit_model.resid
        std_dev = np.std(residuals)
        margin_of_error = 1.96 * std_dev
        
    except Exception as e:
        st.warning(f"Could not fit Holt-Winters model: {e}. Falling back to simple moving average.")
        mean_val = np.mean(y[-min(len(y), 6):])
        forecast = np.array([mean_val] * months)
        std_dev = np.std(y) if len(y) > 1 else 0
        margin_of_error = 1.96 * std_dev

    last_date = df.index.max()
    future_dates = [last_date + pd.DateOffset(months=i) for i in range(1, months + 1)]
    
    future_df = pd.DataFrame({date_col: future_dates})
    future_df['Mean (Base)'] = forecast
    
    optimistic_base = forecast + margin_of_error
    pessimistic_base = forecast - margin_of_error
    
    future_df['Optimistic'] = optimistic_base * (1 + (uplift_pct / 100.0))
    future_df['Pessimistic'] = pessimistic_base * (1 - (downside_pct / 100.0))
    future_df['Type'] = 'Forecast'
    
    hist_df = df.reset_index()
    hist_df['Mean (Base)'] = hist_df[target_col]
    hist_df['Optimistic'] = np.nan
    hist_df['Pessimistic'] = np.nan
    hist_df['Type'] = 'Historical'
    hist_df = hist_df.drop(columns=[target_col])
    
    combined_df = pd.concat([hist_df, future_df], ignore_index=True)
    numeric_cols = combined_df.select_dtypes(include=[np.number]).columns
    combined_df[numeric_cols] = combined_df[numeric_cols].round(2)
    
    return combined_df

def run_stock_and_flow_analysis(df, date_col, inflow_col, outflow_col, base_col, months=6, driver_uplift_pct=0.0, assumed_arpu=0.0):
    df = df.sort_values(by=date_col).copy()
    df = df.dropna(subset=[date_col, inflow_col, outflow_col, base_col])
    
    if df.empty or len(df) < 4:
        return None, "Not enough data points to forecast (need at least 4)."
        
    df = df.groupby(date_col)[[inflow_col, outflow_col, base_col]].sum().reset_index()
    df = df.set_index(date_col)
    
    # Forecast Inflow
    y_inflow = df[inflow_col].values
    try:
        hw_inflow = ExponentialSmoothing(y_inflow, trend='add', seasonal=None, initialization_method="estimated").fit()
        inflow_forecast = hw_inflow.forecast(months)
    except:
        inflow_forecast = np.array([np.mean(y_inflow[-min(len(y_inflow), 6):])] * months)
        
    # Forecast Outflow
    y_outflow = df[outflow_col].values
    try:
        hw_outflow = ExponentialSmoothing(y_outflow, trend='add', seasonal=None, initialization_method="estimated").fit()
        outflow_forecast = hw_outflow.forecast(months)
    except:
        outflow_forecast = np.array([np.mean(y_outflow[-min(len(y_outflow), 6):])] * months)
        
    inflow_uplifted = inflow_forecast * (1 + (driver_uplift_pct / 100.0))
    
    last_date = df.index.max()
    future_dates = [last_date + pd.DateOffset(months=i) for i in range(1, months + 1)]
    
    # Historical Data
    hist_df = df.reset_index()
    hist_df['Type'] = 'Historical'
    hist_df['Inflow (Baseline)'] = hist_df[inflow_col]
    hist_df['Inflow (Uplifted)'] = hist_df[inflow_col]
    hist_df['Outflow'] = hist_df[outflow_col]
    hist_df['Base (Baseline)'] = hist_df[base_col]
    hist_df['Base (Uplifted)'] = hist_df[base_col]
    hist_df['Revenue (Baseline)'] = hist_df[base_col] * assumed_arpu if assumed_arpu > 0 else 0
    hist_df['Revenue (Uplifted)'] = hist_df[base_col] * assumed_arpu if assumed_arpu > 0 else 0
    
    # Forecast Data
    forecast_records = []
    last_base_baseline = df[base_col].iloc[-1]
    last_base_uplifted = df[base_col].iloc[-1]
    
    for i in range(months):
        in_base = inflow_forecast[i]
        in_up = inflow_uplifted[i]
        out = outflow_forecast[i]
        
        new_base_baseline = last_base_baseline + in_base - out
        new_base_uplifted = last_base_uplifted + in_up - out
        
        forecast_records.append({
            date_col: future_dates[i],
            'Type': 'Forecast',
            'Inflow (Baseline)': in_base,
            'Inflow (Uplifted)': in_up,
            'Outflow': out,
            'Base (Baseline)': new_base_baseline,
            'Base (Uplifted)': new_base_uplifted,
            'Revenue (Baseline)': new_base_baseline * assumed_arpu if assumed_arpu > 0 else 0,
            'Revenue (Uplifted)': new_base_uplifted * assumed_arpu if assumed_arpu > 0 else 0
        })
        
        last_base_baseline = new_base_baseline
        last_base_uplifted = new_base_uplifted
        
    future_df = pd.DataFrame(forecast_records)
    
    combined_df = pd.concat([hist_df[[date_col, 'Type', 'Inflow (Baseline)', 'Inflow (Uplifted)', 'Outflow', 'Base (Baseline)', 'Base (Uplifted)', 'Revenue (Baseline)', 'Revenue (Uplifted)']], future_df], ignore_index=True)
    numeric_cols = combined_df.select_dtypes(include=[np.number]).columns
    combined_df[numeric_cols] = combined_df[numeric_cols].round(2)
    
    total_delta = np.sum(future_df['Revenue (Uplifted)']) - np.sum(future_df['Revenue (Baseline)'])
    if assumed_arpu == 0:
        total_delta = np.sum(future_df['Base (Uplifted)']) - np.sum(future_df['Base (Baseline)'])
        
    return combined_df, total_delta

def render_home():
    st.title("Welcome to PROSPECT")
    st.write("Predictive Reporting Of Scenarios & Planned Execution for Commercial Trends.")
    st.write("Please upload your data file to begin.")
    
    uploaded_file = st.file_uploader("Upload Excel or CSV File", type=["xlsx", "xls", "csv"])
    
    if uploaded_file is not None:
        if st.session_state.get('file_name') != uploaded_file.name:
            try:
                if uploaded_file.name.endswith('.csv'):
                    df = pd.read_csv(uploaded_file)
                else:
                    df = pd.read_excel(uploaded_file, engine='openpyxl')
                st.session_state.df = df
                st.session_state.file_name = uploaded_file.name
            except Exception as e:
                st.error(f"Error reading file: {e}")
                return
        
        if st.session_state.get('df') is not None:
            st.success(f"Successfully loaded {st.session_state.file_name} with {len(st.session_state.df)} rows.")
            
            st.write("### Choose a Capability:")
            col1, col2 = st.columns(2)
            with col1:
                if st.button("📈 Standard Forecast", use_container_width=True):
                    st.session_state.page = 'Standard Forecast'
                    st.rerun()
            with col2:
                if st.button("🔮 What-If Analysis", use_container_width=True):
                    st.session_state.page = 'What-If Analysis'
                    st.rerun()

def render_standard_forecast():
    st.title("Standard Forecast")
    if st.session_state.get('df') is None:
        st.warning("Please upload a file on the Home page first.")
        if st.button("Go to Home"):
            st.session_state.page = 'Home'
            st.rerun()
        return
        
    df = st.session_state.df
    columns = df.columns.tolist()
    
    st.subheader("Configuration")
    col_date, col_target = st.columns(2)
    with col_date:
        date_col = st.selectbox("Select Date Column", columns, key="std_date")
    with col_target:
        target_col = st.selectbox("Select Target Column (Numeric)", columns, key="std_target")
        
    st.subheader("Segmentation (Optional)")
    segment_col = st.selectbox("Category Column (e.g. Scenario Type)", ["None"] + columns, key="std_seg")
    segment_mode = "Filter"
    segment_val = None
    
    if segment_col != "None":
        segment_mode = st.radio("Segment Mode", ["Filter to one category", "Compare all categories"], key="std_seg_mode")
        if segment_mode == "Filter to one category":
            unique_vals = df[segment_col].dropna().astype(str).unique()
            segment_val = st.selectbox("Select Category", sorted(unique_vals), key="std_seg_val")
    
    st.subheader("Scenario Tweaks")
    col_up, col_down = st.columns(2)
    with col_up:
        uplift_pct = st.slider("Strategic Uplift % (Optimistic)", min_value=0.0, max_value=100.0, value=10.0, step=1.0)
    with col_down:
        downside_pct = st.slider("Risk Downside % (Pessimistic)", min_value=0.0, max_value=100.0, value=10.0, step=1.0)
    
    if st.button("Generate Standard Forecast", type="primary"):
        if not pd.api.types.is_numeric_dtype(df[target_col]):
            st.error(f"Target column '{target_col}' must be numeric.")
        else:
            try:
                df_std = df.copy()
                df_std[date_col] = pd.to_datetime(df_std[date_col])
            except Exception as e:
                st.error(f"Could not convert column '{date_col}' to dates. {e}")
                return
                
            if segment_col != "None" and segment_mode == "Filter to one category":
                df_std = df_std[df_std[segment_col].astype(str) == segment_val]
                if df_std.empty:
                    st.error(f"No data found for category: {segment_val}")
                    return
                    
            if segment_col != "None" and segment_mode == "Compare all categories":
                with st.spinner("Forecasting multiple categories..."):
                    categories = df_std[segment_col].dropna().astype(str).unique()
                    if len(categories) > 10:
                        st.warning("Too many categories. Limiting to top 10 by volume.")
                        top_cats = df_std[segment_col].value_counts().nlargest(10).index
                        categories = top_cats
                    
                    plot_data = pd.DataFrame()
                    all_raw_data = []
                    
                    for cat in categories:
                        cat_df = df_std[df_std[segment_col].astype(str) == cat]
                        if len(cat_df) < 2:
                            continue
                        
                        f_df = forecast_holt_winters(cat_df, date_col, target_col, months=6, uplift_pct=uplift_pct, downside_pct=downside_pct)
                        
                        hist = f_df[f_df['Type'] == 'Historical'].set_index(date_col)['Mean (Base)'].rename(f"{cat} (Historical)")
                        fcst = f_df[f_df['Type'] == 'Forecast'].set_index(date_col)['Mean (Base)'].rename(f"{cat} (Forecast)")
                        
                        plot_data = pd.concat([plot_data, hist, fcst], axis=1)
                        
                        f_df['Category'] = cat
                        all_raw_data.append(f_df)
                    
                    if not all_raw_data:
                        st.error("Not enough data to forecast any categories.")
                        return
                        
                    combined_raw = pd.concat(all_raw_data, ignore_index=True)
                    
                    st.subheader("Forecast Results (Comparison)")
                    st.line_chart(plot_data)
                    
                    st.subheader("Data Preview")
                    st.dataframe(plot_data.reset_index())
                    
                    output = BytesIO()
                    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
                        combined_raw.to_excel(writer, index=False, sheet_name='Forecast_Comparison')
                        plot_data.reset_index().to_excel(writer, index=False, sheet_name='Wide_Format')
                    processed_data = output.getvalue()
                    
                    st.download_button(
                        label="Download Comparison Data",
                        data=processed_data,
                        file_name="scenario_comparison_results.xlsx",
                        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    )
            else:
                with st.spinner("Forecasting with Holt-Winters..."):
                    forecast_df = forecast_holt_winters(df_std, date_col, target_col, months=6, uplift_pct=uplift_pct, downside_pct=downside_pct)
                    
                st.subheader("Forecast Results")
                plot_df = forecast_df.set_index(date_col)[['Mean (Base)', 'Optimistic', 'Pessimistic']]
                st.line_chart(plot_df)
                
                with st.expander("Forecast Science & Accuracy"):
                    st.write("The model uses historical patterns (trend and seasonality) to project the future using Holt-Winters Exponential Smoothing.")
                
                st.subheader("Data Preview")
                st.dataframe(forecast_df)
                
                output = BytesIO()
                with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
                    forecast_df.to_excel(writer, index=False, sheet_name='Forecast')
                processed_data = output.getvalue()
                
                st.download_button(
                    label="Download Forecasted Data",
                    data=processed_data,
                    file_name="scenario_forecast_results.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                )

def render_what_if_analysis():
    st.title("Segment-Driven Stock-and-Flow Analysis")
    if st.session_state.get('df') is None:
        st.warning("Please upload a file on the Home page first.")
        if st.button("Go to Home"):
            st.session_state.page = 'Home'
            st.rerun()
        return
        
    df = st.session_state.df
    columns = df.columns.tolist()
    
    st.write("Analyze how changes in Inflow impact the overall Base and Revenue using a deterministic waterfall model.")
    
    st.subheader("1. Data Mapping")
    col1, col2, col3 = st.columns(3)
    with col1:
        wi_date_col = st.selectbox("Date Column", columns, key="wi_date")
        wi_inflow_col = st.selectbox("Inflow Column", columns, key="wi_inflow")
    with col2:
        wi_segment_col = st.selectbox("Segment Column", ["None"] + columns, key="wi_seg")
        wi_outflow_col = st.selectbox("Outflow Column", columns, key="wi_outflow")
    with col3:
        wi_base_col = st.selectbox("Base Column", columns, key="wi_base")
        
    st.subheader("Select Customer Segment")
    if wi_segment_col != "None":
        segments = ["All (Aggregated)"] + list(df[wi_segment_col].dropna().astype(str).unique())
        selected_segment = st.selectbox("Customer Segment", segments, key="wi_seg_val")
    else:
        selected_segment = "All (Aggregated)"
        
    st.subheader("Driver Tweaks")
    driver_uplift_pct = st.slider("Inflow Uplift %", min_value=-50.0, max_value=50.0, value=0.0, step=1.0, key="wi_uplift")
    
    with st.expander("Commercial Assumptions (Telecom)"):
        assumed_arpu = st.number_input("Assumed ARPU (£)", min_value=0.0, value=0.0, step=1.0)
    
    if st.button("Run Stock-and-Flow Analysis", type="primary"):
        try:
            df_wi = df.copy()
            df_wi[wi_date_col] = pd.to_datetime(df_wi[wi_date_col])
        except Exception as e:
            st.error(f"Could not convert column '{wi_date_col}' to dates. {e}")
            return
            
        if selected_segment != "All (Aggregated)" and wi_segment_col != "None":
            df_wi = df_wi[df_wi[wi_segment_col].astype(str) == selected_segment]
            if df_wi.empty:
                st.error(f"No data found for segment: {selected_segment}")
                return
                
        with st.spinner("Running Analysis..."):
            result = run_stock_and_flow_analysis(df_wi, wi_date_col, wi_inflow_col, wi_outflow_col, wi_base_col, 6, driver_uplift_pct, assumed_arpu)
            
        if result[0] is None:
            st.error(result[1])
        else:
            combined_df, total_delta = result
            
            st.subheader("Forecast Results")
            if assumed_arpu > 0:
                st.info(f"**Applied Logic:** Projecting a {driver_uplift_pct}% Inflow uplift. Calculating Base = Base(t-1) + Inflow - Outflow. Revenue = Base * £{assumed_arpu} ARPU.")
                if total_delta >= 0:
                    st.success(f"A **{driver_uplift_pct}%** increase in Inflow is projected to generate an additional **£{total_delta:,.2f}** in Revenue over the next 6 months.")
                else:
                    st.warning(f"A **{driver_uplift_pct}%** change in Inflow is projected to result in a **£{total_delta:,.2f}** change in Revenue over the next 6 months.")
            else:
                st.info(f"**Applied Logic:** Projecting a {driver_uplift_pct}% Inflow uplift. Calculating Base = Base(t-1) + Inflow - Outflow.")
                if total_delta >= 0:
                    st.success(f"A **{driver_uplift_pct}%** increase in Inflow is projected to generate an additional **{total_delta:,.2f}** in Base over the next 6 months.")
                else:
                    st.warning(f"A **{driver_uplift_pct}%** change in Inflow is projected to result in a **{total_delta:,.2f}** change in Base over the next 6 months.")
                
            st.subheader("Select KPIs to View")
            selected_kpis = st.multiselect("KPIs", ['Inflow', 'Outflow', 'Base', 'Revenue'], default=['Inflow', 'Base'])
            
            plot_cols = []
            if 'Inflow' in selected_kpis:
                plot_cols.extend(['Inflow (Baseline)', 'Inflow (Uplifted)'])
            if 'Outflow' in selected_kpis:
                plot_cols.append('Outflow')
            if 'Base' in selected_kpis:
                plot_cols.extend(['Base (Baseline)', 'Base (Uplifted)'])
            if 'Revenue' in selected_kpis:
                plot_cols.extend(['Revenue (Baseline)', 'Revenue (Uplifted)'])
                
            if plot_cols:
                plot_df = combined_df.set_index(wi_date_col)[plot_cols]
                st.line_chart(plot_df)
            else:
                st.warning("Please select at least one KPI to view the chart.")
            
            st.subheader("Data Preview")
            st.dataframe(combined_df)
            
            metadata_df = pd.DataFrame({
                'Parameter': ['Segment', 'Inflow Uplift %', 'Assumed ARPU (£)'],
                'Value': [selected_segment, driver_uplift_pct, assumed_arpu]
            })
            
            output = BytesIO()
            with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
                combined_df.to_excel(writer, index=False, sheet_name='StockAndFlow_Analysis')
                metadata_df.to_excel(writer, index=False, sheet_name='Parameters')
            processed_data = output.getvalue()
            
            st.download_button(
                label="Download Analysis Data",
                data=processed_data,
                file_name="stock_and_flow_results.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
            
            with st.expander("📖 User Manual & Methodology"):
                st.markdown("""
                ### How Segment-Driven Stock-and-Flow Analysis Works
                This tool helps you understand how changing Inflow affects your overall Base and Revenue.
                
                1. **Baseline Forecast:** It forecasts Inflow and Outflow into the future using Holt-Winters Exponential Smoothing.
                2. **Scenario Application:** The model applies your chosen **Inflow Uplift %** to the forecasted Inflow.
                3. **Base Calculation:** It calculates the Base deterministically using the formula: `Base(t) = Base(t-1) + Inflow(t) - Outflow(t)`.
                4. **Revenue Projection:** If an ARPU is provided, it calculates Revenue as `Base * ARPU`.
                """)

def main():
    st.set_page_config(page_title="PROSPECT", layout="wide")
    
    if 'page' not in st.session_state:
        st.session_state.page = 'Home'

    st.markdown("<h2 style='text-align: center; color: #e60000; margin-bottom: 0;'>PROSPECT</h2>", unsafe_allow_html=True)
    
    cols = st.columns([1, 2, 1])
    with cols[1]:
        selected_page = st.radio(
            "Navigation",
            ["Home", "Standard Forecast", "What-If Analysis"],
            index=["Home", "Standard Forecast", "What-If Analysis"].index(st.session_state.page),
            horizontal=True,
            label_visibility="collapsed"
        )
        
    if selected_page != st.session_state.page:
        st.session_state.page = selected_page
        st.rerun()

    st.divider()

    if st.session_state.page == 'Home':
        render_home()
    elif st.session_state.page == 'Standard Forecast':
        render_standard_forecast()
    elif st.session_state.page == 'What-If Analysis':
        render_what_if_analysis()

if __name__ == "__main__":
    main()
