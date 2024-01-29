# Store in the ./purple-a11y/results directory with the data from Purple A11y

#!/bin/bash

# Get today's date in YYYYMMDD format
DATE_TODAY=$(date +%Y%m%d)

# Run the Python script with the formatted date
python find-score.py -p $DATE_TODAY -o summary

# Aggregate that into a summary value
python calculate-score.py -d summary 

# Aggregate the calcualated scores
python aggregate_scores.py -d summary%     
