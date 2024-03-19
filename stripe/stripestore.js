const axios = require('axios');
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_KEY);

let allCustomers;

router.get('/get-stripe-customers', async (req, res) => {
    if (req.session.idToken == undefined || req.session.idToken == null) { 
        res.status(401).json({error:"not logged in"}); 
        return; 
    }

    try {
        allCustomers = await getAllCustomers();
        res.status(200).send('Got customers');
    } catch(error) {
        console.error('Failed to fetch customers:', error);
        res.status(500).send({ error: 'Failed to fetch customers' });
    }    
});

router.get('/get-stripe-active-subs', async (req, res) => {
    if (req.session.idToken == undefined || req.session.idToken == null) { 
        res.status(401).json({error:"not logged in"}); 
        return; 
    }
    if (allCustomers == undefined || allCustomers == null) { 
        res.status(500).json({error:"no customer data"}); 
        return; 
    }

    try {
        //const getAllCustResp = await getAllCustomers();
        const activeSubscribers = await filterActiveSubscribers(allCustomers);
        res.send(activeSubscribers);
    } catch (error) {
        console.error('Failed to fetch active subscribers:', error);
        res.status(500).send({ error: 'Failed to fetch active subscribers' });
    }
});

async function getAllCustomers() {
    let allCustomers = [];
    let hasMore = true;
    let startingAfter = null;

    while (hasMore) {
        const params = { limit: 100 };
        if (startingAfter) {
            params.starting_after = startingAfter;
        }

        const customersBatch = await stripe.customers.list(params);

        allCustomers = allCustomers.concat(customersBatch.data);
        hasMore = customersBatch.has_more;

        if (hasMore) {
            startingAfter = customersBatch.data[customersBatch.data.length - 1].id;
        }
    }

    console.log(`Got all customers:${allCustomers.length}`);
    return allCustomers;
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function filterActiveSubscribers(customers) {
    let activeSubscribers = [];

    // Helper function to check for active subscription
    const checkActiveSubscription = async (customer) => {
        try {
            const subscriptions = await stripe.subscriptions.list({
                customer: customer.id,
                status: 'active',
                limit: 1
            });
            if (subscriptions.data.length > 0) {
                return customer;
            }
        } catch (error) {
            console.error(`Error fetching subscriptions for customer ${customer.id}:`, error);
        }
        return null; // Return null if no active subscription or an error occurred
    };

    // Split customers into chunks to manage parallel calls without overwhelming the Stripe API
    const chunkSize = 100; // Adjust based on your rate limit analysis and testing
    for (let i = 0; i < customers.length; i += chunkSize) {
        const customerChunk = customers.slice(i, i + chunkSize);
        const promises = customerChunk.map(checkActiveSubscription);
        const results = await Promise.all(promises); // Wait for all promises in the chunk

        // Filter out nulls and add to activeSubscribers
        activeSubscribers.push(...results.filter(customer => customer !== null));

        if (i + chunkSize < customers.length) {
            await delay(50); // Delay between chunks to prevent rate limit issues
        }
    }

    console.log(`Got all active subs: ${activeSubscribers.length}`);
    return activeSubscribers;
}

module.exports = router;