#!/bin/bash

# Path to your Node.js script
nodeScriptPath="./pa-gTracker.js"
# Path to your YAML configuration file
yamlConfigPath="./pa-gTracker.yml"
# Paths to homebrew executables
yqPath="/opt/homebrew/bin/yq"
timeoutPath="/opt/homebrew/bin/timeout"

# Correcting the iteration approach
siteKeys=$($yqPath e 'keys | .[]' $yamlConfigPath)

# Start the timer
start=$(date +%s.%N)

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

        if [ $type = "break" ]; then
            echo "Stopping program execution..."
            exit
        fi
        echo $type

        # Debugging print
        echo "Run: node --max-old-space-size=6000  $nodeScriptPath --type $type --name $name --url $url --max $max --sheet_id $sheet_id --exclude $exclude --strategy $strategy"
        
        # Run the Node.js script with these parameters (uncomment when ready) 
        "$timeoutPath" 1h node --max-old-space-size=6000  "$nodeScriptPath" --type "$type" --name "$name" --url "$url" --max "$max" --sheet_id "$sheet_id"  --exclude "$exclude" --strategy "$strategy"
        
        # Print the day of the week
        day_of_week=$(date +%A)
        echo "Day of the week: $start_date & today is $day_of_week"
    done

    # Capture the end time for each site
    end=$(date +%s.%N)

    # Calculate the execution time for each site
    duration=$(echo "$end - $start" | bc)

    # Convert to seconds (integer), ignoring sub-second precision for simplicity
    duration_s=${duration%.*}
    
    # Calculate hours, minutes, and seconds
    let duration_h=duration_s/3600
    let duration_m=(duration_s%3600)/60
    let duration_s=(duration_s%60)

    # Format and print the execution time
    duration_formatted=$(printf "%02dh:%02dm:%02ds" $duration_h $duration_m $duration_s)
    echo "Execution time: $duration_formatted"
done
