#Decision Tree for mult-page scans

```mermaid
graph TD;
    DoYouHavePageHitCounts-->GetListOfURLs;
    IsThereASitemap-->IsThereACSV;
    GetListOfURLs-->IsThereASitemap;
    IsThereACSV-->CreateASiteMap;
    IsThereASitemap-->CrawlWithPurpleA11y;
    IsThereASitemap-->IsItTooBig;
    CreateASiteMap-->IsItTooBig;
    IsItTooBig-->RandomizeSitemap;
    CreateASiteMap-->CrawlWithPurpleA11y;
    RandomizeSitemap-->CrawlWithPurpleA11y;
    CrawlWithPurpleA11y-->AggregatePurpleA11yResults;
    AggregatePurpleA11yResults-->CalculatePurpleA11yScore;
    CrawlWithPurpleA11y-->BringCSVIntoGoogleSheet;
    DoYouHavePageHitCounts-->BringCSVIntoGoogleSheet;
    BringCSVIntoGoogleSheet-->EvaluateErrorImpact;
    CalculatePurpleA11yScore-->CompareWithPreviousScans;
    CompareWithPreviousScans-->SendTeamProgressReport;
```

Create a list of domains with the following attributes:

- Domain Name
- CSV path
- Sitemap path / URL
- Monthly scan
