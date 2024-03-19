const axios = require('axios');
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_KEY);

router.get('/get-stripe-customers', async (req, res) => {
    if (req.session.idToken == undefined || req.session.idToken == null) { 
        res.status(401).json({error:"not logged in"}); 
        return; 
    }

    try {
        const allCustomers = await getAllCustomers();
        res.send(allCustomers);
    } catch(error) {
        console.error('Failed to fetch customers:', error);
        res.status(500).send({ error: 'Failed to fetch customers' });
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


router.post('/get-stripe-active-subs', async (req, res) => { // Change to POST to accept body data
    if (req.session.idToken == undefined || req.session.idToken == null) { 
        res.status(401).json({error:"not logged in"}); 
        return; 
    }

    // Expecting the request body to contain an array of customers
    const customers = req.body; // Directly use the provided customer data
    
    if (!Array.isArray(customers) || customers.length === 0) {
        res.status(400).send({ error: 'Invalid customer data' });
        return;
    }

    try {
        const activeSubscribers = await filterActiveSubscribers(customers);
        res.send(activeSubscribers);
    } catch (error) {
        console.error('Failed to fetch active subscribers:', error);
        res.status(500).send({ error: 'Failed to fetch active subscribers' });
    }
});

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function filterActiveSubscribers(customers) {
    let activeSubscribers = [];
    let counter = 0;
    for (const customer of customers) {
        try {
            const subscriptions = await stripe.subscriptions.list({
                customer: customer.id,
                status: 'active',
                limit: 1
            });
            if (subscriptions.data.length > 0) {
                activeSubscribers.push(customer);
            }
        } catch (error) {
            console.error(`Error fetching subscriptions for customer ${customer.id}:`, error);
        }

        // Insert a small delay after processing 10 customers
        // this keeps things fast, but prevents overwhelming stripe API
        counter++;
        if(counter >= 50){ await delay(100); counter = 0; }
    }

    console.log(`Got all active subs:${activeSubscribers.length}`);
    return activeSubscribers;
}

module.exports = router;