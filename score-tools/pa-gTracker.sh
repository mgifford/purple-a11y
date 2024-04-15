#!/bin/bash

# Path to your Node.js script
nodeScriptPath="./pa-gTracker.js"

# Path to your YAML configuration file
yamlConfigPath="./pa-gTracker.yml"

# Correcting the iteration approach
siteKeys=$(yq e 'keys | .[]' $yamlConfigPath)

for siteKey in $siteKeys; do
    counter=$((counter+1))
    echo "\nProcessing site ($counter): $siteKey\n"

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

        # Debugging print
        echo "Run: node --max-old-space-size=6000  $nodeScriptPath --type $type --name $name --url $url --max $max --sheet_id $sheet_id --exclude $exclude"
        
        # Run the Node.js script with these parameters (uncomment when ready) 
        node --max-old-space-size=6000  "$nodeScriptPath" --type "$type" --name "$name" --url "$url" --max "$max" --sheet_id "$sheet_id"  --exclude "$exclude" 
    done
done
