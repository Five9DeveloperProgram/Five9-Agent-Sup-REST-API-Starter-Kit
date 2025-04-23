# Overview

This is a work-in-progress "how to" with some examples of using the Five9 Agetn and Supervisor REST API endpoints.  Forked from [Andrew Willey](https://github.com/andrewawilley)

There are two main documents.  The first (agent_sup_VCC_boilerplate.html) is the most useful in demonstrating individual sample functionality.  It can be opened in the same browser as an active Agent session and provides links on the left-hand side that perform some of the most commonly implemented API actions.

The second (agent_sup_VCC_boilerplage with sockets.html) is a less-fleshed-out functional demonstration page, but shows how you can better leverage the Five9 event socket and attach listeners to events that you may want to react to.  

## Using the Five9 Agent/Supervisor REST API 

As described in the <a href="https://webapps.five9.com/assets/files/for_customers/documentation/apis/vcc-agent+supervisor-rest-api-reference-guide.pdf">documentation</a>, using the VCC REST API endpoints follows this pattern

* Obtain session metadata from [https://app.five9.com/appsvcs/rs/svc/auth/metadata](https://app.five9.com/appsvcs/rs/svc/auth/metadata)
* Build the base api url (API domain:port)
* Determine the appropriate context path for the endpoint
* Invoke the method with the fully formed path

# DISCLAIMER

This repository contains sample code which is **not an official Five9 resource**. It is intended solely for educational and illustrative purposes to demonstrate possible ways to interact with Five9 APIs.

Under the MIT License:

- This is **not** officially endorsed or supported software by Five9.
- Any customizations, modifications, or deployments made with this code are done at your **own risk** and **sole responsibility**.
- The code may not account for all use cases or meet specific requirements without further development.
- Five9 assumes **no liability** and provides **no support** for issues arising from the use of this code.

For production-ready tailored implementations, we strongly recommend working with Five9’s Professional Services and Technical Account Management teams.

