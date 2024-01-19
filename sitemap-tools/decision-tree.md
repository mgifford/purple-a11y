#Decision Tree for mult-page scans

```mermaid
graph TD;
    IsThereASitemap-->IsThereACSV;
    DoYouHavePageCounts-->GetListOfURLs;
    GetListOfURLs-->CreateASiteMap;
    IsThereASitemap-->CrawlWithPurpleA11y;
    IsThereASitemap-->GetListOfURLs;
    DoYouNeedRandom-->RandomizeSitemap;
    IsThereASitemap-->IsItTooBig;
    IsThereASitemap-->RandomizeSitemap;
```
