#!/bin/bash

# Path to your Node.js script
nodeScriptPath="./pa-gTracker.js"

# Path to default YAML configuration file & some executables
yamlConfigPath="./pa-gTracker.yml"
yqPath="/opt/homebrew/bin/yq"
timeoutPath="/opt/homebrew/bin/timeout"


# Check if the -c flag is provided and overwrite the default path if so
while getopts "c:" flag; do
    case $flag in
        c) yamlConfigPath="$OPTARG";;
    esac
done
shift $((OPTIND-1))


# Start the timer
start=$(date +%s.%N)

# Correcting the iteration approach
siteKeys=$($yqPath e 'keys | .[]' $yamlConfigPath)

for siteKey in $siteKeys; do
    counter=$((counter+1))

    echo
    echo "Processing site ($counter): $siteKey"
    echo 

    # Correcting the index looping method
    rows=$($yqPath e ".$siteKey | length" $yamlConfigPath)
    for ((row=0; row<$rows; row++)); do
        # Directly extract each configuration field
        type=$($yqPath e ".$siteKey.[$row].type" $yamlConfigPath)
        name=$($yqPath e ".$siteKey.[$row].name" $yamlConfigPath)
        url=$($yqPath e ".$siteKey.[$row].url" $yamlConfigPath)
        max=$($yqPath e ".$siteKey.[$row].max" $yamlConfigPath)
        sheet_id=$($yqPath e ".$siteKey.[$row].sheet_id" $yamlConfigPath)
        exclude=$($yqPath e ".$siteKey.[$row].exclude" $yamlConfigPath)
        start_date=$($yqPath e ".$siteKey.[$row].start_date" $yamlConfigPath)
        strategy=$($yqPath e ".$siteKey.[$row].strategy" $yamlConfigPath)

        # Get today's day of the week
        today=$(date +%A)
        time=$(date +%H:%M:%S)
        # Check if start_date is equal to today's day
        if [ "$start_date" = "All" ] || [ "$start_date" = "$today" ]; then
            echo "Continuing as start_date matches today's day. Time: $time"
        else
            echo "$name - $start_date skipping to next element..."
            continue
        fi

        if [ $type = "break" ]; then
            echo "Stopping program execution..."
            exit
        fi
        echo $type

        # Debugging print
        # echo "Run: node --max-old-space-size=6000  $nodeScriptPath --type $type --name $name --url $url --max $max --sheet_id $sheet_id --exclude $exclude --strategy $strategy"
        
        # Run the Node.js script with these parameters (uncomment when ready) 
        "$timeoutPath" 1h node --max-old-space-size=6000  "$nodeScriptPath" --type "$type" --name "$name" --url "$url" --max "$max" --sheet_id "$sheet_id"  --exclude "$exclude" --strategy "$strategy"

    done

    # Capture the end time for each site
    end=$(date +%s.%N)

    # Calculate the execution time for each site
    duration=$(echo "$end - $start" | bc)
    duration_s=${duration%.*}
    let duration_h=duration_s/3600
    let duration_m=(duration_s%3600)/60
    let duration_s=(duration_s%60)
    duration_formatted=$(printf "%02dh:%02dm:%02ds" $duration_h $duration_m $duration_s)
    echo "Execution time: $duration_formatted"
done
