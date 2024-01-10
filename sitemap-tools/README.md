# Sitemap XML Tools for Purple A11y

Purple A11y is great tool, but if you need to evaluate more than one site, the results can be a bit hard to manage. 
The raw data is stored in sub-directories, and the most useful summary is in HTML. 

This is an attempt to help aggregate greater number of reports, and provide a greater random sampling of URLs.

## Sitemap Randomizer - sitemap-randomizer.py

Following the general approach of [WCAG-EM](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/) it is good to assume that there are key pages that you want to have sampled for a site (home page, search page, accessibility statement, contact us form, key landing pages, unique content types, etc.), but aside from that you just want statistically relevant random sampling of pages.

This script scans a sitemap for a site and returns a single sitemap.xml file that is a random set of the URLs.
