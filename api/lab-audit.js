import {forwardMarkAudit} from '../src/mark-readonly-proxy.js';
export default function handler(req,res){return forwardMarkAudit(req,res,'user-mark-audit');}
