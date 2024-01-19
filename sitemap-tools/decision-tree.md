#Decision Tree for mult-page scans

```mermaid
graph TD;
    IsThereASitemap-->IsThereACSV;
    DoYouHavePageCounts-->GetListOfURLs;
    GetListOfURLs-->IsThereASitemap;
    GetListOfURLs-->CreateASiteMap;
    IsThereACSV-->CreateASiteMap;
    IsThereASitemap-->CrawlWithPurpleA11y;
    IsThereASitemap-->IsItTooBig;
    IsThereASitemap-->RandomizeSitemap;
    CreateASiteMap-->IsItTooBig;
    IsItTooBig-->RandomizeSitemap;
    RandomizeSitemap-->CrawlWithPurpleA11y;
    CrawlWithPurpleA11y-->AggregatePurpleA11yResults;
    AggregatePurpleA11yResults-->CalculatePurpleA11yScore

```
