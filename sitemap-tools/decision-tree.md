#Decision Tree for mult-page scans

```mermaid
graph TD;
    {IsThereASitemap}-->[IsThereACSV];
    DoYouHavePageCounts-->B;
    IsThereACSV-->D;
    DoYouNeedRandom-->D;
```
