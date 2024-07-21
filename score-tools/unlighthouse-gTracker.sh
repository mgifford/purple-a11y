#!/bin/bash
# unlighthouse-gTracker.sh

# Log the start time of the script
echo "Script started at $(date)" > /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.log


# Navigate to the project directory
cd /Users/mgifford/CA-Sitemap-Scans

# Log Node.js version
/opt/homebrew/bin/node -v >> /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.log 2>&1

# Run the Node.js script
/opt/homebrew/bin/node --expose-gc /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.js >> /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.log 2>&1

# Log the end time of the script
echo "Script ended at $(date)" >> /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.log
