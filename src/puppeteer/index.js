const puppeteer = require('puppeteer');

/**
 * Finds if the pageNumber exists in the pagination bar.
 * @param {Page} page - Page object from the browser
 * @param {Int} pageNumber - page number to check for existance
 * @returns {Boolean} true if page number is found in pagination bar; else false
 */
const checkPageNumber = async (page, pageNumber) =>
  await page.evaluate(pageNumber => {
    const paginationEls = document.querySelectorAll('div.pagination a'); // list of elements relevant to pagination

    for (const el of paginationEls) {
      if (el.innerText === String(pageNumber)) return true; // if the element's
    }

    return false;
  }, pageNumber);

/**
 * Finds the anchor that equals pageNumber and clicks on it.
 * @param {Page} page - Page object from the browser
 * @param {Int} pageNumber - number of current page
 */
const clickOnPage = async (page, pageNumber) => {
  const [anchor] = await page.$x(`//li/a[contains(., '${pageNumber}')]`);

  if (anchor) await anchor.click();
};

/**
 * Scrape info on organization name, data set name, and resources names for data.gov results page
 * @param {Page} page - Page object from the browser
 */
const scrape = async page =>
  await page.evaluate(() => {
    const results = [];
    const nodes = document.querySelectorAll('div.dataset-content');

    nodes.forEach(node => {
      const organization = node?.children[0]?.children[0]?.innerText; // Gets the organization text
      const dataSetName = node?.children[1]?.children[0]?.innerText; // Gets the name of the data set text
      const resources = node?.children[3]?.children; // Gets the list of resources
      const dataFormats = [];

      // iterate over the resources to get their text
      for (let i = 0; i < Number.MAX_SAFE_INTEGER; i++) {
        if (!resources || !resources[i]) break;

        dataFormats.push(resources[i].innerText.trim());
      }

      results.push({ organization, dataSetName, dataFormats });
    });

    return results;
  });

const run = async () => {
  let browser;

  try {
    browser = await puppeteer.launch({ headless: false }); // launch puppeteer instance

    const page = await browser.newPage(); // get reference to a page
    let pageNumber = 1; // keeps track of page number
    let results = []; // stores the scraped data objects

    await page.goto('https://www.data.gov/', { waitUntil: 'networkidle0' }); // visit page and wait until 0 connections are active
    await page.click('#search-header'); // click on the search bar
    await page.type('#search-header', 'agriculture', { delay: 2 }); // slowly type the query into the search bar
    await page.keyboard.press('Enter'); // press the enter key to launch the query

    await page.waitForNavigation({ waitUntil: 'networkidle0' }); // wait for results to show up

    // keep scraping while the pageNumber exists as an anchor in the pagination bar
    while (await checkPageNumber(page, pageNumber)) {
      await clickOnPage(page, pageNumber);
      await page.waitForNavigation({ waitUntil: 'networkidle0' });

      const info = await scrape(page);

      results = [...results, ...info];
      pageNumber++;
    }

    return results;
  } catch (err) {
    console.error(err);
  } finally {
    if (browser) await browser.close();
  }
};

run().then(console.log).catch(console.error);
