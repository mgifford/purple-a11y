#!/bin/bash

# Probably calculate-score.py & find-score.py should be one script. Was just easier for me to build them separately and then mash up the results with bash.
# Put all these files in the results directory of Purple A11y. Make sure that you can execute ./run-both-scores.sh and that calculate-score.py & find-score.py
# are in the same directory. 
# 

# Scan for either todays date or for a match of file name, ie. 20240105
python find-score.py

# Run calculations to produce scores.
python calculate-score.py

# Display results
cat *_result.csv
