#!/bin/zsh
# unlighthouse-gTracker.sh

# Log the start time of the script
echo "Script started at $(date)" > /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.log

# Close Chrome Canary instances after each run
/usr/bin/pkill -f "Google Chrome Canary"
/usr/bin/pkill -f "Google Chrome Helper"

# Navigate to the project directory
cd /Users/mgifford/CA-Sitemap-Scans

# Log Node.js version
echo "Node.js version:" >> /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.log
/opt/homebrew/bin/node -v >> /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.log 2>&1

# Default to today's day of the week
day=$(date +%A)

# Check if a day of the week was provided as an argument
while getopts "d:" opt; do
  case $opt in
    d)
      day=$OPTARG
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >> /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.log
      exit 1
      ;;
  esac
done

# Convert the day variable to Title Case for comparison
day=$(echo "$day" | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}')

# Log the day being used for the script
echo "Day for scanning: $day" >> /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.log

# Print all start_date values to check correctness
echo "All start_date values:" >> /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.log
yq e ".[] | .[].start_date" unlighthouse-sites.yml >> /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.log 2>&1

# Extract URLs for the specified day
echo "Extracting URLs from YAML for day: $day" >> /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.log
urls=$(yq e ".[] | .[] | select(.start_date == \"$day\") | .url" unlighthouse-sites.yml 2>> /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.log)

# Log the extracted URLs
echo "Extracted URLs:" >> /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.log
echo "$urls" >> /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.log

# Function to run a single Unlighthouse process
run_unlighthouse() {
    url=$1
    echo "Processing $url for $day..." >> /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.log
    /opt/homebrew/bin/node --expose-gc --max-old-space-size=8096 /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.js --url="$url" >> /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.log 2>&1
    if [[ $? -ne 0 ]]; then
        echo "Process for $url failed." >> /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.log
    fi
    # Force garbage collection
    /opt/homebrew/bin/node -e 'if (global.gc) { global.gc(); console.log("Garbage collection complete"); }' >> /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.log 2>&1

    # Close Chrome Canary instances after each run
    /usr/bin/pkill -f "Google Chrome Canary"
    /usr/bin/pkill -f "Google Chrome Helper"
}

# Process URLs one by one
echo "$urls" | while IFS= read -r url; do
    run_unlighthouse "$url"
done

# Log the end time of the script
echo "Script ended at $(date)" >> /Users/mgifford/CA-Sitemap-Scans/unlighthouse-gTracker.log
