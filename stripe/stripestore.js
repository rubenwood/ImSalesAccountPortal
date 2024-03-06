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

router.get('/get-stripe-active-subs', async (req, res) => {
    if (req.session.idToken == undefined || req.session.idToken == null) { 
        res.status(401).json({error:"not logged in"}); 
        return; 
    }

    try {
        const allCustomers = await getAllCustomers();
        const activeSubscribers = await filterActiveSubscribers(allCustomers);
        console.log(activeSubscribers.length);
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

async function filterActiveSubscribers(customers) {
    // Use Promise.all with error handling for each subscription check
    const activeSubscribersPromises = customers.map(customer => 
        stripe.subscriptions.list({
            customer: customer.id,
            status: 'active',
            limit: 1
        })
        .then(subscriptions => subscriptions.data.length > 0 ? customer : null)
        .catch(error => {
            console.error(`Error fetching subscriptions for customer ${customer.id}:`, error);
            return null; // In case of error, return null to filter out later
        })
    );

    const results = await Promise.all(activeSubscribersPromises);
    return results.filter(customer => customer !== null); // Filter out nulls
}

module.exports = router;