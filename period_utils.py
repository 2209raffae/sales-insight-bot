from datetime import date, timedelta
import calendar

def iso_year_start(iso_year):
    "The gregorian calendar date of the first day of the given ISO year"
    fourth_jan = date(iso_year, 1, 4)
    delta = timedelta(fourth_jan.isoweekday()-1)
    return fourth_jan - delta 

def iso_to_gregorian(iso_year, iso_week, iso_day):
    "Gregorian calendar date for the given ISO year, week and day"
    year_start = iso_year_start(iso_year)
    return year_start + timedelta(days=iso_day-1, weeks=iso_week-1)

def parse_period(period_type: str, period_value: str) -> tuple[date, date]:
    """
    Parse a period string like "2023-W01", "2023-01", "2023-Q1" into start/end dates.
    Returns (start_date, end_date).
    """
    try:
        parts = period_value.split("-")
        year = int(parts[0])
        val = parts[1].upper()
        
        if period_type == "week" or val.startswith("W"):
            week = int(val.replace("W", ""))
            start = iso_to_gregorian(year, week, 1)
            end = iso_to_gregorian(year, week, 7)
            return start, end
            
        elif period_type == "quarter" or val.startswith("Q"):
            quarter = int(val.replace("Q", ""))
            month_start = (quarter - 1) * 3 + 1
            month_end = quarter * 3
            start = date(year, month_start, 1)
            end = date(year, month_end, calendar.monthrange(year, month_end)[1])
            return start, end
            
        elif period_type == "month":
            month = int(val)
            start = date(year, month, 1)
            end = date(year, month, calendar.monthrange(year, month)[1])
            return start, end
            
    except Exception:
        pass
    
    # default to a day if parsing fails drastically
    return date(1970, 1, 1), date(1970, 1, 1)

def prorate_amount(amount: float, period_start: date, period_end: date, query_start: date, query_end: date) -> float:
    """Prorates an amount over the overlap of period and query."""
    overlap_start = max(period_start, query_start)
    overlap_end = min(period_end, query_end)
    
    if overlap_start > overlap_end:
        return 0.0
        
    overlap_days = (overlap_end - overlap_start).days + 1
    total_days = (period_end - period_start).days + 1
    if total_days <= 0: return 0.0
    
    return round(amount * overlap_days / total_days, 2)
