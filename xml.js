const fetch = require("node-fetch");
const { DOMParser } = require("xmldom");

const XML_URL = "https://oclc.service-now.com/api/now/sp/page?portal_id=24fa0f696f6d36005630496aea3ee4a9";

async function fetchServices() {
  try {
    const res = await fetch(XML_URL);
    const xml = await res.text();

    // Extract all <services>...</services> blocks
    const servicesMatches = xml.match(/<services>[\s\S]*?<\/services>/g);
    if (!servicesMatches) return console.log("No services found");

    const parser = new DOMParser();

    const services = servicesMatches.map(serviceXml => {
      const serviceDoc = parser.parseFromString(serviceXml, "application/xml");
      const link = serviceDoc.getElementsByTagName("link")[0]?.textContent.trim();
      const name = serviceDoc.getElementsByTagName("name")[0]?.textContent.trim();
      const api  = serviceDoc.getElementsByTagName("api")[0]?.textContent.trim();

      const firstDay = serviceDoc.getElementsByTagName("days")[0];
      let msg = null, icon = null;
      if (firstDay) {
        msg  = firstDay.getElementsByTagName("msg")[0]?.textContent.trim() || null;
        icon = firstDay.getElementsByTagName("icon")[0]?.textContent.trim() || null;
      }

      return { link, name, api, firstDay: { msg, icon } };
    });

    console.log(services);

  } catch (err) {
    console.error("Error fetching or parsing XML:", err);
  }
}

fetchServices();