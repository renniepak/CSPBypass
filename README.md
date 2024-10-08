# CSP Bypass

Welcome to **CSPBypass.com**, a tool designed to help ethical hackers bypass restrictive Content Security Policies (CSP) and exploit XSS (Cross-Site Scripting) vulnerabilities on sites where injections are blocked by CSPs that only allow certain whitelisted domains.

## Website

Visit [CSPBypass.com](https://cspbypass.com) to search for existing CSP bypass gadgets that allow you to gain XSS, or contribute your own findings.

## What is a "CSP Bypass gadget"?

Modern websites often use **Content Security Policies (CSP)** to protect against XSS attacks by restricting the sources of executable scripts and other content. In those cases, even when an attacker can inject HTML/javascript into a site, the CSP blocks the payload, allowing only certain whitelisted domains or resources to load.

A **CSP bypass gadget** is a technique that allows the attacker to execute JavaScript despite the restrictive policy, exploiting loopholes in the policy configuration. These are often JSONP endpoints or Javascript libraries hosted on any of the whitelisted domains,

## Purpose

This project is purely for **ethical purposes**. The tool and techniques shared here are intended to help security researchers, ethical hackers, and penetration testers identify potential CSP misconfigurations, responsibly disclose vulnerabilities, and improve web security overall.

**Note:** Always ensure that you have permission to test any website or system and follow all applicable laws and responsible disclosure practices. 

## Responsible Disclosure

This tool is intended to help protect web applications by identifying weaknesses in their CSP configuration. If you discover a new vulnerability, always follow responsible disclosure practices to report the issue to the site owner or developer before making it public.

## How to Contribute

We welcome contributions from the community! If you've discovered a new CSP bypass gadget, we would love for you to share it.

Here’s how you can contribute:
1. Fork this repository.
2. Add your CSP bypass gadget in the appropriate format. They must contain the domain name and a working PoC. The minimum viable PoC is alert box without the ability to pass any arguments, or an alert box showing arbitrary data (caused by a JSONP response). Please try to keep data.tsv in alphabetical order. This helps to spot duplicates.
3. Submit a pull request with your findings.

Your contributions will help make the web safer for everyone by improving understanding of CSPs and how they can be strengthened against bypass techniques.

Help improve CSPBypass.com by contributing today! We look forward to your pull requests and input.

## Contact

For any inquiries, reach out to [@renniepak on X](https://x.com/renniepak).


