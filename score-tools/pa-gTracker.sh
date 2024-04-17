#!/bin/bash

# Path to your Node.js script
nodeScriptPath="./pa-gTracker.js"

# Path to your YAML configuration file
yamlConfigPath="./pa-gTracker.yml"

# Correcting the iteration approach
siteKeys=$(yq e 'keys | .[]' $yamlConfigPath)

# Start the timer
start=$(date +%s.%N)

for siteKey in $siteKeys; do
    counter=$((counter+1))

    echo
    echo "Processing site ($counter): $siteKey"
    echo 

    # Correcting the index looping method
    rows=$(yq e ".$siteKey | length" $yamlConfigPath)
    for ((row=0; row<$rows; row++)); do
        # Directly extract each configuration field
        type=$(yq e ".$siteKey.[$row].type" $yamlConfigPath)
        name=$(yq e ".$siteKey.[$row].name" $yamlConfigPath)
        url=$(yq e ".$siteKey.[$row].url" $yamlConfigPath)
        max=$(yq e ".$siteKey.[$row].max" $yamlConfigPath)
        sheet_id=$(yq e ".$siteKey.[$row].sheet_id" $yamlConfigPath)
        exclude=$(yq e ".$siteKey.[$row].exclude" $yamlConfigPath)
        start_date=$(yq e ".$siteKey.[$row].start_date" $yamlConfigPath)

        if [ "$type" = "break" ]; then
            echo "Stopping program execution..."
            exit
        fi

        # Debugging print
        echo "Run: node --max-old-space-size=6000  $nodeScriptPath --type $type --name $name --url $url --max $max --sheet_id $sheet_id --exclude $exclude"
        
        # Run the Node.js script with these parameters (uncomment when ready) 
        timeout 1h node --max-old-space-size=6000  "$nodeScriptPath" --type "$type" --name "$name" --url "$url" --max "$max" --sheet_id "$sheet_id"  --exclude "$exclude" 
        
        # Print the day of the week
        day_of_week=$(date +%A)
        echo "Day of the week: $start_date & today is $day_of_week"
    done

    # Calculate the execution time
    end=$(date +%s.%N)
    duration=$(echo "$end - $start" | bc)
    duration_h=$(echo "$duration / 3600" | bc)
    duration_m=$(echo "($duration % 3600) / 60" | bc)
    duration_s=$(echo "$duration % 60" | bc)
    
    # Check if duration is a valid number
    if [[ ! $duration =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
        duration=0
    fi
    
    duration_formatted=$(printf "%02d:%02d:%02d" "$duration_h" "$duration_m" "$duration_s")

    # Print the execution time
    echo "Execution time: $duration_formatted"

done
