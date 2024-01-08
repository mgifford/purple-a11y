#!/bin/bash

# Scan for either todays date or for a match of file name, ie. 20240105
python find-score.py

# Run calculations to produce scores.
python calculate-score.py

# Display results
cat *_result.csv
